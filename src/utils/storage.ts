import type { BatchSubmission, SampleRatingDraft } from '../types/rating';

const STORAGE_PREFIX = 'trellis_attack_eval_v1';

export function getSessionId(): string {
  const key = `${STORAGE_PREFIX}:session_id`;
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const created = `session_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
  localStorage.setItem(key, created);
  return created;
}

export function getBatchStartedAt(batchId: string): string {
  const key = `${STORAGE_PREFIX}:started:${batchId}`;
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const now = new Date().toISOString();
  localStorage.setItem(key, now);
  return now;
}

export function saveLastBatchIndex(index: number): void {
  localStorage.setItem(`${STORAGE_PREFIX}:last_batch_index`, String(index));
}

export function readLastBatchIndex(): number | undefined {
  const value = localStorage.getItem(`${STORAGE_PREFIX}:last_batch_index`);
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function draftKey(batchId: string): string {
  return `${STORAGE_PREFIX}:draft:${batchId}`;
}

export function readDraft(batchId: string): Record<string, SampleRatingDraft> {
  const raw = localStorage.getItem(draftKey(batchId));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, SampleRatingDraft>;
  } catch {
    return {};
  }
}

export function saveDraft(batchId: string, draft: Record<string, SampleRatingDraft>): void {
  localStorage.setItem(draftKey(batchId), JSON.stringify(draft));
}

export function clearDraft(batchId: string): void {
  localStorage.removeItem(draftKey(batchId));
}

export function readSubmissions(): BatchSubmission[] {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}:submissions`);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as BatchSubmission[];
  } catch {
    return [];
  }
}

export function appendSubmission(submission: BatchSubmission): BatchSubmission[] {
  const submissions = readSubmissions();
  const next = [submission, ...submissions];
  localStorage.setItem(`${STORAGE_PREFIX}:submissions`, JSON.stringify(next));
  return next;
}

export function clearAllLocalData(): void {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(STORAGE_PREFIX))
    .forEach((key) => localStorage.removeItem(key));
}
