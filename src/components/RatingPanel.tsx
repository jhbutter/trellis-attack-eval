import type { SampleRatingDraft } from '../types/rating';

type Props = {
  rating: SampleRatingDraft;
  onChange: (rating: SampleRatingDraft) => void;
};

function ScoreInput({
  title,
  subtitle,
  value,
  onChange,
  lowLabel,
  highLabel
}: {
  title: string;
  subtitle: string;
  value?: number;
  onChange: (value: number | undefined) => void;
  lowLabel: string;
  highLabel: string;
}) {
  const sliderValue = value ?? 5;
  return (
    <div className="score-card">
      <div className="score-header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <div className={`score-badge ${value === undefined ? 'empty' : ''}`}>{value ?? '未评分'}</div>
      </div>
      <div className="score-range-wrap">
        <span>{lowLabel}</span>
        <input
          type="range"
          min="1"
          max="10"
          step="1"
          value={sliderValue}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <span>{highLabel}</span>
      </div>
      <div className="number-row">
        <label>数字输入</label>
        <input
          type="number"
          min="1"
          max="10"
          placeholder="1-10"
          value={value ?? ''}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === '') return onChange(undefined);
            const parsed = Number(raw);
            if (Number.isFinite(parsed)) onChange(Math.min(10, Math.max(1, Math.round(parsed))));
          }}
        />
      </div>
    </div>
  );
}

export function RatingPanel({ rating, onChange }: Props) {
  const update = (patch: Partial<SampleRatingDraft>) => {
    onChange({ ...rating, ...patch, updatedAt: new Date().toISOString() });
  };

  return (
    <section className="rating-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">Subjective Rating</span>
          <h2>主观评分</h2>
        </div>
        <span className="pill warning">必须完成两项评分</span>
      </div>

      <div className="rating-grid">
        <ScoreInput
          title="攻击隐蔽性 Visual Stealthiness"
          subtitle="比较原图与对抗样本图。差异越小、越不易察觉，分数越高。"
          value={rating.visualStealthiness}
          onChange={(value) => update({ visualStealthiness: value })}
          lowLabel="明显异常"
          highLabel="几乎无差异"
        />
        <ScoreInput
          title="攻击有效性 Attack Effectiveness"
          subtitle="比较攻击前后 3D 重建结果。攻击后重建破坏越明显，分数越高。"
          value={rating.attackEffectiveness}
          onChange={(value) => update({ attackEffectiveness: value })}
          lowLabel="几乎无效"
          highLabel="严重破坏"
        />
      </div>

      <label className="comment-box">
        <span>备注，可选</span>
        <textarea
          placeholder="例如：adv 图像扰动不明显，但 recon_adv.glb 出现明显几何扭曲或语义偏移。"
          value={rating.comment || ''}
          onChange={(event) => update({ comment: event.target.value })}
        />
      </label>
    </section>
  );
}
