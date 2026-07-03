import '@google/model-viewer';
import React, { useEffect, useState } from 'react';
import { Maximize2, RotateCcw } from 'lucide-react';
import { datasetConfig } from '../data/datasetConfig';

type Props = {
  title: string;
  src: string;
  fallbackSrc?: string;
};

export function ModelViewer({ title, src, fallbackSrc = datasetConfig.placeholder.model }: Props) {
  const ModelViewerElement = 'model-viewer' as unknown as React.ElementType;
  const [currentSrc, setCurrentSrc] = useState(src);
  const [viewerKey, setViewerKey] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setFailed(false);
    setViewerKey((value) => value + 1);
  }, [src]);

  function handleError() {
    if (currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setFailed(true);
    }
  }

  function resetCamera() {
    setViewerKey((value) => value + 1);
  }

  function openInNewTab() {
    window.open(currentSrc, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="model-card">
      <div className="panel-header compact">
        <div>
          <span className="eyebrow">GLB Viewer</span>
          <h3>{title}</h3>
        </div>
        <div className="inline-actions">
          <button type="button" className="icon-button" onClick={resetCamera} title="重置视角">
            <RotateCcw size={16} />
          </button>
          <button type="button" className="icon-button" onClick={openInNewTab} title="新窗口打开模型">
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
      {failed && <div className="fallback-note">真实模型未加载，当前显示 Demo placeholder。</div>}
      <ModelViewerElement
        key={`${currentSrc}-${viewerKey}`}
        src={currentSrc}
        alt={title}
        camera-controls
        interaction-prompt="auto"
        exposure="0.95"
        shadow-intensity="1"
        environment-image="neutral"
        loading="lazy"
        reveal="auto"
        camera-orbit="35deg 70deg 2.8m"
        field-of-view="28deg"
        style={{ width: '100%', height: '330px', background: 'linear-gradient(145deg, #08111f, #101525)' }}
        onError={handleError}
      />
    </section>
  );
}
