import { ImageComparePanel } from './ImageComparePanel';
import { ModelViewer } from './ModelViewer';
import { EffectivenessRatingPanel, ImageAssessmentPanel } from './RatingPanel';
import type { Sample } from '../types/dataset';
import type { SampleRatingDraft } from '../types/rating';

type Props = {
  sample: Sample;
  rating: SampleRatingDraft;
  onRatingChange: (rating: SampleRatingDraft) => void;
};

export function SampleCard({ sample, rating, onRatingChange }: Props) {
  return (
    <div className="sample-card">
      <div className="sample-meta-row">
        <div>
          <span className="eyebrow">Current Sample</span>
          <h1>{sample.sampleId}</h1>
        </div>
        <div className="meta-chips">
          <span>{sample.category}</span>
          <span>index {sample.index.toString().padStart(4, '0')}</span>
          <span>{sample.batchId}</span>
        </div>
      </div>

      <ImageComparePanel
        oriSrc={sample.files.oriImage}
        advSrc={sample.files.advImage}
        sampleId={sample.sampleId}
      />

      <ImageAssessmentPanel rating={rating} onChange={onRatingChange} />

      <section className="models-section">
        <div className="panel-header">
          <div>
            <span className="eyebrow">Step 3 · 3D Reconstruction Comparison</span>
            <h2>原始资产 / 原图重建 / 对抗图重建</h2>
          </div>
          <span className="pill">支持旋转缩放</span>
        </div>
        <div className="model-grid">
          <ModelViewer title="原始 3D 资产" src={sample.files.gtModel} />
          <ModelViewer title="原图对应 3D 重建结果" src={sample.files.reconOriModel} />
          <ModelViewer title="对抗样本图对应 3D 重建结果" src={sample.files.reconAdvModel} />
        </div>
      </section>

      <EffectivenessRatingPanel rating={rating} onChange={onRatingChange} />
    </div>
  );
}
