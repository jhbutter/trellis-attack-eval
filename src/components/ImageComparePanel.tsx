import { useState } from 'react';
import { datasetConfig } from '../data/datasetConfig';

type Props = {
  oriSrc: string;
  advSrc: string;
  sampleId: string;
};

function ImageTile({ title, src, fallback }: { title: string; src: string; fallback: string }) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [failed, setFailed] = useState(false);
  return (
    <figure className="image-tile">
      <div className="image-label">{title}</div>
      {failed && <span className="image-fallback-label">placeholder</span>}
      <img
        src={currentSrc}
        alt={title}
        onError={() => {
          setCurrentSrc(fallback);
          setFailed(true);
        }}
      />
    </figure>
  );
}

export function ImageComparePanel({ oriSrc, advSrc, sampleId }: Props) {
  const [position, setPosition] = useState(50);
  const [ori, setOri] = useState(oriSrc);
  const [adv, setAdv] = useState(advSrc);

  return (
    <section className="comparison-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">2D Input Comparison</span>
          <h2>原图 vs 对抗样本图</h2>
        </div>
        <span className="pill">{sampleId}</span>
      </div>

      <div className="image-grid">
        <ImageTile title="Original Image" src={oriSrc} fallback={datasetConfig.placeholder.oriImage} />
        <ImageTile title="Adversarial Image" src={advSrc} fallback={datasetConfig.placeholder.advImage} />
      </div>

      <div className="slider-compare-card">
        <div className="slider-title">
          <span>滑动对比视图</span>
          <strong>{position}%</strong>
        </div>
        <div className="slider-compare">
          <img src={adv} alt="adversarial overlay" onError={() => setAdv(datasetConfig.placeholder.advImage)} />
          <div className="slider-ori-layer" style={{ width: `${position}%` }}>
            <img src={ori} alt="original overlay" onError={() => setOri(datasetConfig.placeholder.oriImage)} />
          </div>
          <div className="slider-handle" style={{ left: `${position}%` }} />
          <input
            aria-label="image comparison slider"
            type="range"
            min="0"
            max="100"
            value={position}
            onChange={(event) => setPosition(Number(event.target.value))}
          />
        </div>
      </div>
    </section>
  );
}
