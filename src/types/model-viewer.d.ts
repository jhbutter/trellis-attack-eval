import React from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        alt?: string;
        poster?: string;
        'camera-controls'?: boolean | string;
        'auto-rotate'?: boolean | string;
        'disable-zoom'?: boolean | string;
        'shadow-intensity'?: string;
        exposure?: string;
        'camera-orbit'?: string;
        'field-of-view'?: string;
        'environment-image'?: string;
        loading?: 'auto' | 'lazy' | 'eager';
        reveal?: 'auto' | 'interaction' | 'manual';
      };
    }
  }
}
