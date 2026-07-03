/// <reference types="vite/client" />

declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      src?: string;
      alt?: string;
      poster?: string;
      'camera-controls'?: boolean | string;
      'auto-rotate'?: boolean | string;
      'interaction-prompt'?: string;
      exposure?: string;
      'shadow-intensity'?: string;
      'environment-image'?: string;
      loading?: string;
      reveal?: string;
      'camera-orbit'?: string;
      'field-of-view'?: string;
      'min-camera-orbit'?: string;
      'max-camera-orbit'?: string;
      style?: React.CSSProperties;
    };
  }
}
