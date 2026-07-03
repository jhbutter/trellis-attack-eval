#!/usr/bin/env python3
"""Serve the Trellis attack evaluation app with a small SQLite API.

This server intentionally uses only Python's standard library so it can run in
the TRELLIS environment even when Gradio/FastAPI are not installed.
"""

from __future__ import annotations

import argparse
import csv
import json
import mimetypes
import os
import random
import sqlite3
import sys
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse


APP_DIR = Path(__file__).resolve().parent
DIST_DIR = Path(os.environ.get("TRELLIS_EVAL_STATIC_DIR", APP_DIR / "dist")).resolve()
PUBLIC_DIR = (APP_DIR / "public").resolve()
DATA_DIR = Path(os.environ.get("TRELLIS_EVAL_DATA_DIR", APP_DIR / "data")).resolve()
DB_PATH = Path(os.environ.get("TRELLIS_EVAL_DB", DATA_DIR / "evaluation.sqlite3")).resolve()
MANIFEST_PATH = Path(os.environ.get("TRELLIS_EVAL_MANIFEST", APP_DIR / "manifest.json")).resolve()

CATEGORIES = [
    "A1",
    "A2",
    "A3",
    "A4",
    "A5",
    "A6",
    "A7",
    "A8",
    "A9",
    "A10",
    "B1",
    "B2",
    "B3",
    "B4",
    "B5",
    "B6",
]
SAMPLES_PER_CATEGORY = 50
BATCH_SIZE = 10
MAX_CONCURRENT_USERS = 99


def connect_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.execute("PRAGMA busy_timeout = 30000")
    return conn


def public_url(path: str | None, fallback: str) -> str:
    if not path:
        return fallback
    if path.startswith(("http://", "https://", "/")):
        return path
    return "/" + path.replace("\\", "/").lstrip("/")


def sample_from_manifest_item(item: dict, position: int) -> dict:
    category = str(item.get("category") or "UNK")
    index = int(item.get("index") or item.get("sample_index") or (position + 1))
    batch_index = int(item.get("batch_index", position // BATCH_SIZE))
    batch_id = str(item.get("batch_id") or f"batch_{batch_index:03d}")
    sample_id = str(item.get("sample_id") or f"{category}_{index:04d}")
    files = item.get("files") or {}

    return {
        "sampleId": sample_id,
        "category": category,
        "index": index,
        "batchId": batch_id,
        "files": {
            "oriImage": public_url(files.get("oriImage") or item.get("clean_image"), "/placeholder/ori.png"),
            "advImage": public_url(files.get("advImage") or item.get("adv_image"), "/placeholder/adv.png"),
            "gtModel": public_url(files.get("gtModel") or item.get("reference_glb"), "/placeholder/demo.glb"),
            "reconOriModel": public_url(
                files.get("reconOriModel") or item.get("clean_recon_glb"),
                "/placeholder/demo.glb",
            ),
            "reconAdvModel": public_url(
                files.get("reconAdvModel") or item.get("adv_recon_glb"),
                "/placeholder/demo.glb",
            ),
        },
        "metadata": item.get("metadata") or {},
    }


def load_manifest(path: Path = MANIFEST_PATH) -> tuple[list[dict], bool]:
    if not path.exists():
        return generate_demo_samples(), True

    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    items = payload.get("samples", payload) if isinstance(payload, dict) else payload
    if not isinstance(items, list):
        raise ValueError("manifest must be a list or an object with a 'samples' list")
    return [sample_from_manifest_item(item, idx) for idx, item in enumerate(items)], False


def generate_demo_samples() -> list[dict]:
    samples: list[dict] = []
    for category in CATEGORIES:
        for index in range(1, SAMPLES_PER_CATEGORY + 1):
            position = len(samples)
            batch_index = position // BATCH_SIZE
            samples.append(
                {
                    "sampleId": f"{category}_{index:04d}",
                    "category": category,
                    "index": index,
                    "batchId": f"batch_{batch_index:03d}",
                    "files": {
                        "oriImage": f"/dataset/{category}/{index:04d}/ori.png",
                        "advImage": f"/dataset/{category}/{index:04d}/adv.png",
                        "gtModel": f"/dataset/{category}/{index:04d}/gt.glb",
                        "reconOriModel": f"/dataset/{category}/{index:04d}/recon_ori.glb",
                        "reconAdvModel": f"/dataset/{category}/{index:04d}/recon_adv.glb",
                    },
                    "metadata": {
                        "notes": "Demo metadata. Missing assets fall back to placeholder files.",
                    },
                }
            )
    return samples


def build_batches(samples: list[dict], batch_size: int = BATCH_SIZE) -> list[dict]:
    batches: list[dict] = []
    for batch_index, start in enumerate(range(0, len(samples), batch_size)):
        chunk = samples[start : start + batch_size]
        batch_id = f"batch_{batch_index:03d}"
        normalized = []
        for sample in chunk:
            next_sample = dict(sample)
            next_sample["batchId"] = batch_id
            normalized.append(next_sample)
        batches.append({"batchId": batch_id, "batchIndex": batch_index, "samples": normalized})
    return batches


SAMPLES, DEMO_MODE = load_manifest()
BATCHES = build_batches(SAMPLES)
BATCH_BY_ID = {batch["batchId"]: batch for batch in BATCHES}


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with connect_db() as conn:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA synchronous = NORMAL")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS submissions (
                submission_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                user_id TEXT,
                batch_id TEXT NOT NULL,
                completed_count INTEGER NOT NULL,
                total_count INTEGER NOT NULL,
                started_at TEXT,
                submitted_at TEXT NOT NULL,
                payload_json TEXT NOT NULL,
                created_at REAL NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS ratings (
                rating_id TEXT PRIMARY KEY,
                submission_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                user_id TEXT,
                batch_id TEXT NOT NULL,
                sample_id TEXT NOT NULL,
                category TEXT,
                sample_index INTEGER,
                image_similarity_same INTEGER,
                selected_original_image TEXT,
                original_confidence INTEGER,
                visual_stealthiness INTEGER NOT NULL,
                attack_effectiveness INTEGER NOT NULL,
                comment TEXT,
                started_at TEXT,
                submitted_at TEXT NOT NULL,
                user_agent TEXT,
                payload_json TEXT NOT NULL,
                created_at REAL NOT NULL,
                UNIQUE(session_id, batch_id, sample_id)
            )
            """
        )
        existing = {row[1] for row in conn.execute("PRAGMA table_info(ratings)")}
        for column, column_type in {
            "image_similarity_same": "INTEGER",
            "selected_original_image": "TEXT",
            "original_confidence": "INTEGER",
        }.items():
            if column not in existing:
                conn.execute(f"ALTER TABLE ratings ADD COLUMN {column} {column_type}")


def validate_score(value: object, field_name: str) -> int:
    try:
        score = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must be an integer from 1 to 10") from exc
    if score < 1 or score > 10:
        raise ValueError(f"{field_name} must be an integer from 1 to 10")
    return score


def validate_percent(value: object, field_name: str) -> int:
    try:
        percent = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} must be an integer from 0 to 100") from exc
    if percent < 0 or percent > 100:
        raise ValueError(f"{field_name} must be an integer from 0 to 100")
    return percent


def parse_similarity(value: object) -> bool:
    if isinstance(value, bool):
        return value
    raise ValueError("imageSimilaritySame must be true or false")


def legacy_visual_score(similarity_same: bool, confidence: int | None) -> int:
    if similarity_same:
        return 10
    if confidence is None:
        return 1
    return max(1, min(10, round((100 - confidence) / 10) or 1))


def save_submission(payload: dict) -> None:
    ratings = payload.get("ratings")
    if not isinstance(ratings, list) or not ratings:
        raise ValueError("submission.ratings must be a non-empty list")

    submission_id = str(payload.get("submissionId") or "")
    session_id = str(payload.get("sessionId") or "")
    batch_id = str(payload.get("batchId") or "")
    submitted_at = str(payload.get("submittedAt") or "")
    if not submission_id or not session_id or not batch_id or not submitted_at:
        raise ValueError("submissionId, sessionId, batchId and submittedAt are required")

    now = time.time()
    payload_json = json.dumps(payload, ensure_ascii=False)
    with connect_db() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO submissions (
                submission_id, session_id, user_id, batch_id, completed_count,
                total_count, started_at, submitted_at, payload_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                submission_id,
                session_id,
                payload.get("userId"),
                batch_id,
                int(payload.get("completedCount") or len(ratings)),
                int(payload.get("totalCount") or len(ratings)),
                payload.get("startedAt"),
                submitted_at,
                payload_json,
                now,
            ),
        )

        for rating in ratings:
            if not isinstance(rating, dict):
                raise ValueError("each rating must be an object")
            similarity_same = parse_similarity(rating.get("imageSimilaritySame"))
            selected_original = None
            original_confidence = None
            if not similarity_same:
                selected_original = str(rating.get("selectedOriginalImage") or "")
                if selected_original not in {"image_a", "image_b"}:
                    raise ValueError("selectedOriginalImage must be image_a or image_b when imageSimilaritySame is false")
                original_confidence = validate_percent(rating.get("originalConfidence"), "originalConfidence")
            visual = validate_score(
                rating.get("visualStealthiness") or legacy_visual_score(similarity_same, original_confidence),
                "visualStealthiness",
            )
            effectiveness = validate_score(rating.get("attackEffectiveness"), "attackEffectiveness")
            rating_id = str(rating.get("ratingId") or f"{submission_id}:{rating.get('sampleId')}")
            sample_id = str(rating.get("sampleId") or "")
            if not sample_id:
                raise ValueError("rating.sampleId is required")
            conn.execute(
                """
                INSERT INTO ratings (
                    rating_id, submission_id, session_id, user_id, batch_id, sample_id,
                    category, sample_index, image_similarity_same, selected_original_image,
                    original_confidence, visual_stealthiness, attack_effectiveness,
                    comment, started_at, submitted_at, user_agent, payload_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(session_id, batch_id, sample_id) DO UPDATE SET
                    rating_id = excluded.rating_id,
                    submission_id = excluded.submission_id,
                    user_id = excluded.user_id,
                    category = excluded.category,
                    sample_index = excluded.sample_index,
                    image_similarity_same = excluded.image_similarity_same,
                    selected_original_image = excluded.selected_original_image,
                    original_confidence = excluded.original_confidence,
                    visual_stealthiness = excluded.visual_stealthiness,
                    attack_effectiveness = excluded.attack_effectiveness,
                    comment = excluded.comment,
                    started_at = excluded.started_at,
                    submitted_at = excluded.submitted_at,
                    user_agent = excluded.user_agent,
                    payload_json = excluded.payload_json,
                    created_at = excluded.created_at
                """,
                (
                    rating_id,
                    submission_id,
                    session_id,
                    payload.get("userId") or rating.get("userId"),
                    batch_id,
                    sample_id,
                    rating.get("category"),
                    int(rating.get("sampleIndex") or 0),
                    1 if similarity_same else 0,
                    selected_original,
                    original_confidence,
                    visual,
                    effectiveness,
                    rating.get("comment"),
                    rating.get("startedAt") or payload.get("startedAt"),
                    rating.get("submittedAt") or submitted_at,
                    rating.get("userAgent"),
                    json.dumps(rating, ensure_ascii=False),
                    now,
                ),
            )


def list_submissions() -> list[dict]:
    with connect_db() as conn:
        conn.row_factory = sqlite3.Row
        submission_rows = conn.execute(
            """
            SELECT * FROM submissions
            ORDER BY submitted_at DESC, created_at DESC
            """
        ).fetchall()
        submissions: list[dict] = []
        for submission in submission_rows:
            rating_rows = conn.execute(
                """
                SELECT * FROM ratings
                WHERE submission_id = ?
                ORDER BY sample_id
                """,
                (submission["submission_id"],),
            ).fetchall()
            if not rating_rows:
                continue
            ratings = [
                {
                    "ratingId": row["rating_id"],
                    "userId": row["user_id"] or None,
                    "batchId": row["batch_id"],
                    "sampleId": row["sample_id"],
                    "category": row["category"] or "",
                    "sampleIndex": row["sample_index"] or 0,
                    "imageSimilaritySame": None if row["image_similarity_same"] is None else bool(row["image_similarity_same"]),
                    "selectedOriginalImage": row["selected_original_image"] or None,
                    "originalConfidence": row["original_confidence"],
                    "visualStealthiness": row["visual_stealthiness"],
                    "attackEffectiveness": row["attack_effectiveness"],
                    "comment": row["comment"] or "",
                    "startedAt": row["started_at"] or "",
                    "submittedAt": row["submitted_at"],
                    "userAgent": row["user_agent"] or "",
                    "sessionId": row["session_id"],
                }
                for row in rating_rows
            ]
            submissions.append(
                {
                    "submissionId": submission["submission_id"],
                    "userId": submission["user_id"] or None,
                    "sessionId": submission["session_id"],
                    "batchId": submission["batch_id"],
                    "ratings": ratings,
                    "completedCount": len(ratings),
                    "totalCount": submission["total_count"],
                    "startedAt": submission["started_at"] or "",
                    "submittedAt": submission["submitted_at"],
                }
            )
        return submissions


def csv_rows() -> list[list[object]]:
    rows: list[list[object]] = [
        [
            "submission_id",
            "session_id",
            "user_id",
            "batch_id",
            "sample_id",
            "category",
            "sample_index",
            "image_similarity_same",
            "selected_original_image",
            "original_confidence",
            "visual_stealthiness",
            "attack_effectiveness",
            "comment",
            "started_at",
            "submitted_at",
            "user_agent",
        ]
    ]
    with connect_db() as conn:
        conn.row_factory = sqlite3.Row
        for row in conn.execute(
            """
            SELECT * FROM ratings
            ORDER BY submitted_at DESC, batch_id, sample_id
            """
        ):
            rows.append(
                [
                    row["submission_id"],
                    row["session_id"],
                    row["user_id"] or "",
                    row["batch_id"],
                    row["sample_id"],
                    row["category"] or "",
                    row["sample_index"] or 0,
                    "" if row["image_similarity_same"] is None else ("yes" if row["image_similarity_same"] else "no"),
                    row["selected_original_image"] or "",
                    "" if row["original_confidence"] is None else row["original_confidence"],
                    row["visual_stealthiness"],
                    row["attack_effectiveness"],
                    row["comment"] or "",
                    row["started_at"] or "",
                    row["submitted_at"],
                    row["user_agent"] or "",
                ]
            )
    return rows


def dataset_summary() -> dict:
    category_count = len({sample["category"] for sample in SAMPLES})
    return {
        "categoryCount": category_count,
        "samplesPerCategory": SAMPLES_PER_CATEGORY,
        "totalSamples": len(SAMPLES),
        "samplesPerBatch": BATCH_SIZE,
        "totalBatches": len(BATCHES),
        "batchMode": "sequential",
        "demoMode": DEMO_MODE,
    }


class EvaluationHandler(SimpleHTTPRequestHandler):
    server_version = "TrellisAttackEval/1.0"

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        try:
            if path == "/api/health":
                self.send_json({
                    "ok": True,
                    "db": str(DB_PATH),
                    "staticDir": str(DIST_DIR),
                    "maxConcurrentUsers": MAX_CONCURRENT_USERS,
                    "networkMode": "mainland-compatible-local-assets",
                })
                return
            if path == "/api/summary":
                self.send_json(dataset_summary())
                return
            if path == "/api/batches":
                self.send_json(BATCHES)
                return
            if path == "/api/batch/random":
                exclude = query.get("exclude", [None])[0]
                choices = [batch for batch in BATCHES if batch["batchId"] != exclude] or BATCHES
                self.send_json(random.choice(choices))
                return
            if path.startswith("/api/batch/"):
                batch_id = unquote(path.rsplit("/", 1)[-1])
                batch = BATCH_BY_ID.get(batch_id)
                if not batch:
                    self.send_error(HTTPStatus.NOT_FOUND, "batch not found")
                    return
                self.send_json(batch)
                return
            if path == "/api/submissions":
                self.send_json(list_submissions())
                return
            if path == "/api/export.csv":
                self.send_csv()
                return
            self.serve_static(path)
        except Exception as exc:  # noqa: BLE001 - surface API errors to the browser.
            self.send_json({"ok": False, "error": str(exc)}, status=HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_HEAD(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.send_response(HTTPStatus.OK)
            self.end_headers()
            return
        self.serve_static(parsed.path, include_body=False)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/api/submissions":
                payload = self.read_json_body()
                save_submission(payload)
                self.send_json({"ok": True})
                return
            self.send_error(HTTPStatus.NOT_FOUND, "not found")
        except ValueError as exc:
            self.send_json({"ok": False, "error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
        except Exception as exc:  # noqa: BLE001 - keep failed writes visible.
            self.send_json({"ok": False, "error": str(exc)}, status=HTTPStatus.INTERNAL_SERVER_ERROR)

    def read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length") or "0")
        raw = self.rfile.read(length)
        if not raw:
            raise ValueError("empty JSON body")
        payload = json.loads(raw.decode("utf-8"))
        if not isinstance(payload, dict):
            raise ValueError("JSON body must be an object")
        return payload

    def send_json(self, payload: object, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_csv(self) -> None:
        from io import StringIO

        buffer = StringIO()
        writer = csv.writer(buffer)
        writer.writerows(csv_rows())
        body = buffer.getvalue().encode("utf-8-sig")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", 'attachment; filename="trellis_attack_eval_results.csv"')
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_static(self, request_path: str, include_body: bool = True) -> None:
        path = unquote(request_path.split("?", 1)[0])
        if path == "/":
            path = "/index.html"

        candidates = []
        if path.startswith("/dataset/"):
            candidates.extend([DIST_DIR / path.lstrip("/"), PUBLIC_DIR / path.lstrip("/")])
        else:
            candidates.append(DIST_DIR / path.lstrip("/"))

        for candidate in candidates:
            resolved = candidate.resolve()
            if is_inside(resolved, DIST_DIR) or is_inside(resolved, PUBLIC_DIR):
                if resolved.is_file():
                    self.send_file(resolved, include_body=include_body)
                    return

        index = DIST_DIR / "index.html"
        if index.is_file() and not path.startswith(("/assets/", "/placeholder/", "/dataset/")):
            self.send_file(index, include_body=include_body)
            return
        self.send_error(HTTPStatus.NOT_FOUND, "file not found")

    def send_file(self, path: Path, include_body: bool = True) -> None:
        ctype = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
        if path.suffix == ".glb":
            ctype = "model/gltf-binary"
        size = path.stat().st_size
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(size))
        if is_inside(path, DIST_DIR / "assets"):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        elif path.name == "index.html":
            self.send_header("Cache-Control", "no-cache")
        else:
            self.send_header("Cache-Control", "public, max-age=300")
        self.end_headers()
        if include_body:
            self.wfile.write(path.read_bytes())

    def log_message(self, fmt: str, *args: object) -> None:
        sys.stderr.write("[%s] %s\n" % (self.log_date_time_string(), fmt % args))


class ConcurrentEvaluationServer(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True


def is_inside(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Serve Trellis attack evaluation platform")
    parser.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "7861")))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not (DIST_DIR / "index.html").exists():
        raise SystemExit(f"Missing frontend build at {DIST_DIR}. Run `npm run build` first.")
    init_db()
    mimetypes.add_type("application/javascript", ".js")
    mimetypes.add_type("text/css", ".css")
    mimetypes.add_type("model/gltf-binary", ".glb")
    server = ConcurrentEvaluationServer((args.host, args.port), EvaluationHandler)
    print(f"Trellis attack evaluation platform: http://{args.host}:{args.port}", flush=True)
    print(f"LAN access target: http://192.168.112.249:{args.port}", flush=True)
    print(f"Concurrent users target: {MAX_CONCURRENT_USERS}", flush=True)
    print(f"SQLite results: {DB_PATH}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
