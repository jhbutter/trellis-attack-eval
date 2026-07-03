import type { CandidateImage, SampleRatingDraft } from '../types/rating';

type Props = {
  rating: SampleRatingDraft;
  onChange: (rating: SampleRatingDraft) => void;
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function ScoreInput({
  title,
  subtitle,
  value,
  onChange,
  lowLabel,
  highLabel,
  min,
  max,
  suffix
}: {
  title: string;
  subtitle: string;
  value?: number;
  onChange: (value: number | undefined) => void;
  lowLabel: string;
  highLabel: string;
  min: number;
  max: number;
  suffix?: string;
}) {
  const sliderValue = value ?? Math.round((min + max) / 2);
  return (
    <div className="score-card">
      <div className="score-header">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <div className={`score-badge ${value === undefined ? 'empty' : ''}`}>{value === undefined ? '未评分' : `${value}${suffix || ''}`}</div>
      </div>
      <div className="score-range-wrap">
        <span>{lowLabel}</span>
        <input
          type="range"
          min={min}
          max={max}
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
          min={min}
          max={max}
          placeholder={`${min}-${max}`}
          value={value ?? ''}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === '') return onChange(undefined);
            const parsed = Number(raw);
            if (Number.isFinite(parsed)) onChange(clampNumber(parsed, min, max));
          }}
        />
      </div>
    </div>
  );
}

export function ImageAssessmentPanel({ rating, onChange }: Props) {
  const update = (patch: Partial<SampleRatingDraft>) => {
    onChange({ ...rating, ...patch, updatedAt: new Date().toISOString() });
  };

  function setSimilarity(value: boolean) {
    update({
      imageSimilaritySame: value,
      selectedOriginalImage: value ? undefined : rating.selectedOriginalImage,
      originalConfidence: value ? undefined : rating.originalConfidence
    });
  }

  function setSelectedOriginalImage(value: CandidateImage) {
    update({ selectedOriginalImage: value });
  }

  return (
    <section className="rating-panel image-assessment-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">Step 2 · Subjective Image Judgement</span>
          <h2>图像相似性主观判断</h2>
        </div>
        <span className="pill warning">必填</span>
      </div>

      <div className="assessment-card">
        <h3>这两张图的相似度是否足以判断为同一张图？</h3>
        <div className="segmented-choice">
          <button
            type="button"
            className={rating.imageSimilaritySame === true ? 'active' : ''}
            onClick={() => setSimilarity(true)}
          >
            是，足以判断为同一张图
          </button>
          <button
            type="button"
            className={rating.imageSimilaritySame === false ? 'active danger' : ''}
            onClick={() => setSimilarity(false)}
          >
            否，不足以判断为同一张图
          </button>
        </div>
      </div>

      {rating.imageSimilaritySame === false && (
        <div className="assessment-grid">
          <div className="assessment-card">
            <h3>如果不是，请选择一张图作为主观评测下的原图</h3>
            <div className="image-pick-grid">
              <button
                type="button"
                className={rating.selectedOriginalImage === 'image_a' ? 'active' : ''}
                onClick={() => setSelectedOriginalImage('image_a')}
              >
                图像 A
              </button>
              <button
                type="button"
                className={rating.selectedOriginalImage === 'image_b' ? 'active' : ''}
                onClick={() => setSelectedOriginalImage('image_b')}
              >
                图像 B
              </button>
            </div>
          </div>
          <ScoreInput
            title="原图选择置信度"
            subtitle="你对上述主观原图选择的把握程度。"
            value={rating.originalConfidence}
            onChange={(value) => update({ originalConfidence: value })}
            lowLabel="0%"
            highLabel="100%"
            min={0}
            max={100}
            suffix="%"
          />
        </div>
      )}
    </section>
  );
}

export function EffectivenessRatingPanel({ rating, onChange }: Props) {
  const update = (patch: Partial<SampleRatingDraft>) => {
    onChange({ ...rating, ...patch, updatedAt: new Date().toISOString() });
  };

  return (
    <section className="rating-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">Step 4 · Attack Effectiveness</span>
          <h2>3D 重建攻击有效性评分</h2>
        </div>
        <span className="pill warning">必填</span>
      </div>

      <ScoreInput
        title="攻击有效性 Attack Effectiveness"
        subtitle="比较原图与对抗样本图对应的 3D 重建结果。攻击造成的结构、纹理或语义变化越明显，分数越高。"
        value={rating.attackEffectiveness}
        onChange={(value) => update({ attackEffectiveness: value })}
        lowLabel="几乎无变化"
        highLabel="显著破坏"
        min={1}
        max={10}
      />

      <label className="comment-box">
        <span>备注，可选</span>
        <textarea
          placeholder="例如：对抗图对应的重建结果出现几何缺失、结构扭曲、纹理漂移或语义变化。"
          value={rating.comment || ''}
          onChange={(event) => update({ comment: event.target.value })}
        />
      </label>
    </section>
  );
}
