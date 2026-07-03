import type { Batch } from '../types/dataset';
import type { SampleRatingDraft } from '../types/rating';

function isComplete(rating?: SampleRatingDraft): boolean {
  if (!rating || rating.imageSimilaritySame === undefined || rating.attackEffectiveness === undefined) return false;
  if (rating.imageSimilaritySame) return true;
  return Boolean(rating.selectedOriginalImage && rating.originalConfidence !== undefined);
}

type Props = {
  batch: Batch;
  draft: Record<string, SampleRatingDraft>;
  onSelect: (index: number) => void;
  currentIndex: number;
};

export function BatchSummary({ batch, draft, onSelect, currentIndex }: Props) {
  return (
    <aside className="batch-summary">
      <div className="panel-header compact">
        <div>
          <span className="eyebrow">Batch Samples</span>
          <h3>{batch.batchId}</h3>
        </div>
      </div>
      <div className="sample-nav-list">
        {batch.samples.map((sample, index) => {
          const complete = isComplete(draft[sample.sampleId]);
          return (
            <button
              type="button"
              key={sample.sampleId}
              className={`sample-nav-item ${index === currentIndex ? 'active' : ''} ${complete ? 'done' : ''}`}
              onClick={() => onSelect(index)}
            >
              <span>{index + 1}</span>
              <strong>{sample.sampleId}</strong>
              <em>{complete ? '已评分' : '未完成'}</em>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
