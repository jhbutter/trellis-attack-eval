import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Database, Download, Play, RefreshCcw, Save, Send, Trash2, Users } from 'lucide-react';
import { getBatch, getDatasetSummary, getRandomBatch } from './api/datasetApi';
import { getLocalSubmissions, submitBatchSubmission } from './api/ratingApi';
import { isSupabaseEnabled } from './api/supabaseClient';
import { BatchSummary } from './components/BatchSummary';
import { ProgressBar } from './components/ProgressBar';
import { SampleCard } from './components/SampleCard';
import type { Batch, DatasetSummary } from './types/dataset';
import type { BatchSubmission, Rating, SampleRatingDraft } from './types/rating';
import { downloadText, submissionsToCsv } from './utils/exportCsv';
import { clearAllLocalData, clearDraft, getBatchStartedAt, getSessionId, readDraft, saveDraft } from './utils/storage';
import { uid } from './utils/random';
import './styles/globals.css';

type View = 'home' | 'evaluation' | 'results';

function isRatingComplete(rating?: SampleRatingDraft): boolean {
  return Boolean(rating && rating.visualStealthiness !== undefined && rating.attackEffectiveness !== undefined);
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
  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draft, setDraft] = useState<Record<string, SampleRatingDraft>>({});
  const [submissions, setSubmissions] = useState<BatchSubmission[]>([]);
  const [serverOnline, setServerOnline] = useState(false);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    getDatasetSummary().then(setSummary);
    getLocalSubmissions().then(setSubmissions);
    fetch('/api/health', { headers: { Accept: 'application/json' } })
      .then((response) => setServerOnline(response.ok && (response.headers.get('content-type') || '').includes('application/json')))
      .catch(() => setServerOnline(false));

    const batchId = getBatchIdFromHash();
    if (batchId) {
      getBatch(batchId).then((found) => {
        if (found) loadBatch(found);
      });
    }
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

  function loadBatch(nextBatch: Batch) {
    setBatch(nextBatch);
    setCurrentIndex(0);
    setDraft(readDraft(nextBatch.batchId));
    getBatchStartedAt(nextBatch.batchId);
    setRoute('evaluation', nextBatch.batchId);
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
        visualStealthiness: item.visualStealthiness!,
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
        <TopBar onHome={() => setRoute('home')} onResults={() => setRoute('results')} />
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
        <TopBar onHome={() => setRoute('home')} onResults={() => setRoute('results')} />
        <section className="evaluation-header">
          <div>
            <span className="eyebrow">Evaluation Batch</span>
            <h1>{batch.batchId}</h1>
            <p>当前样本：第 {currentIndex + 1} / {batch.samples.length} 个。请先完成两个评分维度，再进入下一个样本。</p>
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
      <TopBar onHome={() => setRoute('home')} onResults={() => setRoute('results')} />
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Trellis · Single Image 3D Reconstruction</span>
          <h1>对抗攻击效果在线评测平台</h1>
          <p>
            用于评估对抗样本在 Trellis 单图 3D 重建流程中的攻击隐蔽性与攻击有效性。当前为 Demo 版本，已预留真实数据路径、GLB 预览、批次抽样、评分提交和在线部署接口。
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={startRandomBatch}>
              <Play size={18} /> 随机抽取一个批次开始评测
            </button>
            <button type="button" className="secondary-button" onClick={() => setRoute('results')}>
              <Database size={18} /> 查看已提交结果
            </button>
          </div>
        </div>
        <div className="hero-card">
          <div className="status-dot" />
          <h2>运行状态</h2>
          <p>{summary?.demoMode ? 'Demo 数据模式' : '真实数据模式'}</p>
          <p>{serverOnline ? '集中保存：服务器 SQLite 已启用' : '集中保存：未连接服务器 API，使用本地浏览器存储'}</p>
          <p>{isSupabaseEnabled ? '备用云端：Supabase 已配置' : '访问地址：请使用服务器 IP 与端口，例如 192.168.112.249:7861'}</p>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="类别数量" value={summary?.categoryCount ?? 16} detail="A1-A10, B1-B6" />
        <StatCard label="样本总数" value={summary?.totalSamples ?? 800} detail="16 × 50" />
        <StatCard label="批次数量" value={summary?.totalBatches ?? 80} detail="每批 10 个样本" />
        <StatCard label="评分维度" value={2} detail="隐蔽性 + 有效性" />
      </section>

      <section className="instruction-grid">
        <div className="info-card">
          <h2>评分维度</h2>
          <p><strong>攻击隐蔽性：</strong>原图与对抗图越难用肉眼区分，分数越高。</p>
          <p><strong>攻击有效性：</strong>攻击前后 3D 重建结果差异越大，分数越高。</p>
        </div>
        <div className="info-card">
          <h2>在线访问方案</h2>
          <p>静态演示可部署到 Vercel、Netlify、Cloudflare Pages 或 GitHub Pages。</p>
          <p>多人集中收集评分结果时，建议配置 Supabase 表作为轻量云端数据库。</p>
        </div>
        <div className="info-card">
          <h2>真实数据接入</h2>
          <p>将真实文件放入 <code>public/dataset/类别/编号/</code>，并保持 ori.png、adv.png、gt.glb、recon_ori.glb、recon_adv.glb 命名即可。</p>
        </div>
      </section>
      {status && <div className="toast">{status}</div>}
    </main>
  );
}

function TopBar({ onHome, onResults }: { onHome: () => void; onResults: () => void }) {
  return (
    <nav className="topbar">
      <button type="button" className="brand" onClick={onHome}>
        <span className="brand-mark">T</span>
        <span>Trellis Attack Eval</span>
      </button>
      <div className="topbar-actions">
        <button type="button" onClick={onResults}>结果</button>
        <a href="https://github.com/" target="_blank" rel="noreferrer"><Database size={16} /> GitHub</a>
        <span className="cloud-mode"><Users size={16} /> {isSupabaseEnabled ? 'Cloud Sync' : 'Server Sync'}</span>
      </div>
    </nav>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </div>
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
              <th>Stealthiness</th>
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
                <td>{rating.visualStealthiness}</td>
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
