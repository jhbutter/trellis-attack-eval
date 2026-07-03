import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Box, ChevronLeft, Download, Eye, Gauge, Play, RefreshCcw, Save, Send, Trash2 } from 'lucide-react';
import { getBatch, getRandomBatch } from './api/datasetApi';
import { getLocalSubmissions, submitBatchSubmission } from './api/ratingApi';
import { BatchSummary } from './components/BatchSummary';
import { ProgressBar } from './components/ProgressBar';
import { SampleCard } from './components/SampleCard';
import type { Batch } from './types/dataset';
import type { BatchSubmission, Rating, SampleRatingDraft } from './types/rating';
import { downloadText, submissionsToCsv } from './utils/exportCsv';
import { clearAllLocalData, clearDraft, getBatchStartedAt, getSessionId, readDraft, saveDraft } from './utils/storage';
import { uid } from './utils/random';
import './styles/globals.css';

type View = 'home' | 'evaluation' | 'results';

function isRatingComplete(rating?: SampleRatingDraft): boolean {
  if (!rating || rating.imageSimilaritySame === undefined || rating.attackEffectiveness === undefined) return false;
  if (rating.imageSimilaritySame) return true;
  return Boolean(rating.selectedOriginalImage && rating.originalConfidence !== undefined);
}

function deriveLegacyStealthScore(rating: SampleRatingDraft): number {
  if (rating.imageSimilaritySame) return 10;
  const confidence = rating.originalConfidence ?? 100;
  return Math.max(1, Math.min(10, Math.round((100 - confidence) / 10) || 1));
}

function getInitialView(): View {
  const hash = window.location.hash.replace('#', '');
  if (hash.startsWith('/results')) return 'results';
  if (hash.startsWith('/batch/')) return 'evaluation';
  return 'home';
}

function getBatchIdFromHash(): string | undefined {
  const match = window.location.hash.match(/#\/batch\/(batch_\d{3})/);
  return match?.[1];
}

export default function App() {
  const [view, setView] = useState<View>(getInitialView);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draft, setDraft] = useState<Record<string, SampleRatingDraft>>({});
  const [submissions, setSubmissions] = useState<BatchSubmission[]>([]);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    getLocalSubmissions().then(setSubmissions);

    function syncRouteFromHash() {
      const route = getInitialView();
      const batchId = getBatchIdFromHash();
      if (route === 'evaluation' && batchId) {
        getBatch(batchId).then((found) => {
          if (found) loadBatch(found, false);
        });
        return;
      }
      setView(route);
    }

    syncRouteFromHash();
    window.addEventListener('hashchange', syncRouteFromHash);
    return () => window.removeEventListener('hashchange', syncRouteFromHash);
  }, []);

  const completedCount = useMemo(() => {
    if (!batch) return 0;
    return batch.samples.filter((sample) => isRatingComplete(draft[sample.sampleId])).length;
  }, [batch, draft]);

  const currentSample = batch?.samples[currentIndex];

  function setRoute(nextView: View, batchId?: string) {
    setView(nextView);
    if (nextView === 'home') window.location.hash = '/';
    if (nextView === 'results') window.location.hash = '/results';
    if (nextView === 'evaluation' && batchId) window.location.hash = `/batch/${batchId}`;
  }

  function loadBatch(nextBatch: Batch, updateRoute = true) {
    setBatch(nextBatch);
    setCurrentIndex(0);
    setDraft(readDraft(nextBatch.batchId));
    getBatchStartedAt(nextBatch.batchId);
    if (updateRoute) setRoute('evaluation', nextBatch.batchId);
    else setView('evaluation');
  }

  function goBack() {
    if (view === 'home') return;
    const currentHash = window.location.hash;
    if (window.history.length > 1) {
      window.history.back();
      window.setTimeout(() => {
        if (window.location.hash === currentHash) setRoute('home');
      }, 120);
      return;
    }
    setRoute('home');
  }

  async function startRandomBatch() {
    const randomBatch = await getRandomBatch();
    loadBatch(randomBatch);
  }

  function updateRating(sampleId: string, rating: SampleRatingDraft) {
    if (!batch) return;
    const next = { ...draft, [sampleId]: rating };
    setDraft(next);
    saveDraft(batch.batchId, next);
    setStatus('评分已暂存到当前浏览器。');
  }

  function goToSample(index: number) {
    if (!batch) return;
    if (index < 0 || index >= batch.samples.length) return;
    setCurrentIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goNext() {
    if (!currentSample) return;
    if (!isRatingComplete(draft[currentSample.sampleId])) {
      setStatus('当前样本尚未完成两个评分项，不能进入下一个样本。');
      return;
    }
    goToSample(Math.min(currentIndex + 1, (batch?.samples.length || 1) - 1));
  }

  async function submitBatch() {
    if (!batch) return;
    const missing = batch.samples.filter((sample) => !isRatingComplete(draft[sample.sampleId]));
    if (missing.length > 0) {
      setStatus(`仍有 ${missing.length} 个样本未完成评分。`);
      return;
    }

    const confirmed = window.confirm('确认提交当前批次的全部评分？提交后会清除当前批次暂存草稿。');
    if (!confirmed) return;

    const sessionId = getSessionId();
    const startedAt = getBatchStartedAt(batch.batchId);
    const submittedAt = new Date().toISOString();

    const ratings: Rating[] = batch.samples.map((sample) => {
      const item = draft[sample.sampleId];
      return {
        ratingId: uid('rating'),
        batchId: batch.batchId,
        sampleId: sample.sampleId,
        category: sample.category,
        sampleIndex: sample.index,
        imageSimilaritySame: item.imageSimilaritySame!,
        selectedOriginalImage: item.imageSimilaritySame ? undefined : item.selectedOriginalImage,
        originalConfidence: item.imageSimilaritySame ? undefined : item.originalConfidence,
        visualStealthiness: deriveLegacyStealthScore(item),
        attackEffectiveness: item.attackEffectiveness!,
        comment: item.comment,
        startedAt,
        submittedAt,
        userAgent: navigator.userAgent,
        sessionId
      };
    });

    const submission: BatchSubmission = {
      submissionId: uid('sub'),
      sessionId,
      batchId: batch.batchId,
      ratings,
      completedCount: ratings.length,
      totalCount: batch.samples.length,
      startedAt,
      submittedAt
    };

    const result = await submitBatchSubmission(submission);
    clearDraft(batch.batchId);
    setDraft({});
    const updated = await getLocalSubmissions();
    setSubmissions(updated);
    const modeLabel = result.mode === 'server'
      ? '服务器 SQLite + 本地备份'
      : result.mode === 'supabase'
        ? 'Supabase 云端 + 本地备份'
        : '本地浏览器存储';
    setStatus(result.ok
      ? `提交成功。保存模式：${modeLabel}${result.error ? `（${result.error}）` : ''}。`
      : `本地已保存，但远端写入失败：${result.error}`);
    setRoute('results');
  }

  function exportJson() {
    downloadText('trellis_attack_eval_results.json', JSON.stringify(submissions, null, 2), 'application/json;charset=utf-8');
  }

  async function exportCsv() {
    try {
      const response = await fetch('/api/export.csv');
      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.includes('text/csv')) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'trellis_attack_eval_results.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }
    } catch {
      // Static deployments without the Python server still export local records.
    }
    downloadText('trellis_attack_eval_results.csv', submissionsToCsv(submissions), 'text/csv;charset=utf-8');
  }

  function resetLocalData() {
    if (!window.confirm('确认清除本机浏览器内的全部暂存和提交记录？')) return;
    clearAllLocalData();
    setDraft({});
    setSubmissions([]);
    setStatus('本地数据已清除。');
  }

  if (view === 'results') {
    return (
      <main className="app-shell">
        <TopBar view={view} onHome={() => setRoute('home')} onBack={goBack} />
        <section className="hero compact-hero">
          <span className="eyebrow">Results</span>
          <h1>评分结果</h1>
          <p>当前页面优先显示服务器 SQLite 中汇总的提交记录；如果后端不可用，则显示本机浏览器备份。</p>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={exportCsv} disabled={submissions.length === 0}>
              <Download size={18} /> 导出 CSV
            </button>
            <button type="button" className="secondary-button" onClick={exportJson} disabled={submissions.length === 0}>
              <Download size={18} /> 导出 JSON
            </button>
            <button type="button" className="danger-button" onClick={resetLocalData}>
              <Trash2 size={18} /> 清空本地记录
            </button>
          </div>
        </section>
        <ResultsTable submissions={submissions} />
        {status && <div className="toast">{status}</div>}
      </main>
    );
  }

  if (view === 'evaluation' && batch && currentSample) {
    return (
      <main className="app-shell evaluation-shell">
        <TopBar view={view} onHome={() => setRoute('home')} onBack={goBack} />
        <section className="evaluation-header">
          <div>
            <span className="eyebrow">Evaluation Batch</span>
            <h1>{batch.batchId}</h1>
            <p>当前样本：第 {currentIndex + 1} / {batch.samples.length} 个。请按顺序完成图像相似性判断、主观原图选择和 3D 攻击有效性评分。</p>
          </div>
          <div className="header-progress-card">
            <ProgressBar completed={completedCount} total={batch.samples.length} label="当前批次完成度" />
          </div>
        </section>

        <div className="evaluation-layout">
          <BatchSummary batch={batch} draft={draft} currentIndex={currentIndex} onSelect={goToSample} />
          <div className="main-evaluation-column">
            <SampleCard
              sample={currentSample}
              rating={draft[currentSample.sampleId] || {}}
              onRatingChange={(rating) => updateRating(currentSample.sampleId, rating)}
            />

            <div className="sticky-actions">
              <button type="button" className="secondary-button" onClick={() => goToSample(currentIndex - 1)} disabled={currentIndex === 0}>
                <ArrowLeft size={18} /> 上一个样本
              </button>
              <button type="button" className="secondary-button" onClick={() => saveDraft(batch.batchId, draft)}>
                <Save size={18} /> 暂存
              </button>
              <button type="button" className="primary-button" onClick={goNext} disabled={currentIndex === batch.samples.length - 1}>
                下一个样本 <ArrowRight size={18} />
              </button>
              <button type="button" className="submit-button" onClick={submitBatch} disabled={completedCount !== batch.samples.length}>
                <Send size={18} /> 提交批次
              </button>
            </div>
          </div>
        </div>
        {status && <div className="toast">{status}</div>}
      </main>
    );
  }

  return (
      <main className="app-shell">
      <TopBar view={view} onHome={() => setRoute('home')} onBack={goBack} />
      <section className="hero home-hero">
        <div className="hero-copy">
          <span className="eyebrow">Trellis · Single Image 3D Reconstruction</span>
          <h1>对抗攻击效果在线评测平台</h1>
          <p>
            平台用于主观评估单图 3D 重建流程中的对抗攻击效果。每次随机抽取 10 个样本，评测者先判断两张输入图是否足以视为同一张图，再查看 3D 重建结果并评价攻击有效性。
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={startRandomBatch}>
              <Play size={18} /> 开始随机批次评测
            </button>
          </div>
        </div>
      </section>

      <section className="home-dimension-grid">
        <div className="info-card">
          <Eye size={22} />
          <h2>图像相似性判断</h2>
          <p>先只观察两张输入图，判断它们的相似度是否足以被认为是同一张图。若不足以判断为同一张图，请选择主观上更像原图的一张，并给出 0% 到 100% 置信度。</p>
        </div>
        <div className="info-card">
          <Box size={22} />
          <h2>3D 资产对比</h2>
          <p>随后查看原始资产、原图重建结果和对抗样本图重建结果。所有 GLB 模型均支持旋转、缩放和重置视角。</p>
        </div>
        <div className="info-card">
          <Gauge size={22} />
          <h2>攻击有效性评分</h2>
          <p>比较原图与对抗样本图对应的 3D 重建结果，主观评价攻击是否造成结构、纹理或语义层面的显著变化，分值范围为 1 到 10。</p>
        </div>
      </section>
      {status && <div className="toast">{status}</div>}
    </main>
  );
}

function TopBar({ view, onHome, onBack }: { view: View; onHome: () => void; onBack: () => void }) {
  return (
    <nav className="topbar">
      <button type="button" className="brand" onClick={onHome}>
        <span className="brand-mark">T</span>
        <span>Trellis Attack Eval</span>
      </button>
      <div className="topbar-actions">
        {view !== 'home' && (
          <button type="button" onClick={onBack}>
            <ChevronLeft size={16} /> 返回
          </button>
        )}
      </div>
    </nav>
  );
}

function ResultsTable({ submissions }: { submissions: BatchSubmission[] }) {
  if (submissions.length === 0) {
    return (
      <section className="empty-results">
        <RefreshCcw size={36} />
        <h2>暂无提交结果</h2>
        <p>完成任意一个批次评测后，结果会显示在这里。</p>
      </section>
    );
  }

  const rows = submissions.flatMap((submission) => submission.ratings.map((rating) => ({ submission, rating })));

  return (
    <section className="results-card">
      <div className="panel-header">
        <div>
          <span className="eyebrow">Local Result Records</span>
          <h2>{submissions.length} 次批次提交 · {rows.length} 条评分</h2>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Batch</th>
              <th>Sample</th>
              <th>Category</th>
              <th>Same Image</th>
              <th>Picked Original</th>
              <th>Confidence</th>
              <th>Effectiveness</th>
              <th>Comment</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ submission, rating }) => (
              <tr key={`${submission.submissionId}-${rating.sampleId}`}>
                <td>{submission.batchId}</td>
                <td>{rating.sampleId}</td>
                <td>{rating.category}</td>
                <td>{rating.imageSimilaritySame === undefined ? '-' : rating.imageSimilaritySame ? 'Yes' : 'No'}</td>
                <td>{rating.selectedOriginalImage === 'image_a' ? 'Image A' : rating.selectedOriginalImage === 'image_b' ? 'Image B' : '-'}</td>
                <td>{rating.originalConfidence === undefined ? '-' : `${rating.originalConfidence}%`}</td>
                <td>{rating.attackEffectiveness}</td>
                <td>{rating.comment || '-'}</td>
                <td>{new Date(submission.submittedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
