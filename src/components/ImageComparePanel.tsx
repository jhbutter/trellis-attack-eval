import { useEffect, useState } from 'react';
import { datasetConfig } from '../data/datasetConfig';

type Props = {
  oriSrc: string;
  advSrc: string;
  sampleId: string;
};

function ImageTile({ title, src, fallback }: { title: string; src: string; fallback: string }) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setFailed(false);
  }, [src]);

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
  return (
    <section className="comparison-panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">Step 1 · Image Pair</span>
          <h2>请先仅观察两张输入图</h2>
        </div>
        <span className="pill">{sampleId}</span>
      </div>

      <div className="image-grid">
        <ImageTile title="图像 A" src={oriSrc} fallback={datasetConfig.placeholder.oriImage} />
        <ImageTile title="图像 B" src={advSrc} fallback={datasetConfig.placeholder.advImage} />
      </div>
    </section>
  );
}
