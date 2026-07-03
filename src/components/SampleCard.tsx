import { ImageComparePanel } from './ImageComparePanel';
import { ModelViewer } from './ModelViewer';
import { RatingPanel } from './RatingPanel';
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

      <section className="models-section">
        <div className="panel-header">
          <div>
            <span className="eyebrow">3D Reconstruction Comparison</span>
            <h2>原始资产 / 原图重建 / 对抗图重建</h2>
          </div>
          <span className="pill">统一交互视图</span>
        </div>
        <div className="model-grid">
          <ModelViewer title="Ground Truth / Reference 3D Asset" src={sample.files.gtModel} />
          <ModelViewer title="Reconstruction from Original Image" src={sample.files.reconOriModel} />
          <ModelViewer title="Reconstruction from Adversarial Image" src={sample.files.reconAdvModel} />
        </div>
      </section>

      <RatingPanel rating={rating} onChange={onRatingChange} />
    </div>
  );
}
