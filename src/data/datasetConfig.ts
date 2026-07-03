import type { CategoryId } from '../types/dataset';

export const datasetConfig = {
  categories: [
    'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10',
    'B1', 'B2', 'B3', 'B4', 'B5', 'B6'
  ] as CategoryId[],
  samplesPerCategory: 50,
  samplesPerBatch: 10,
  batchMode: 'sequential' as 'sequential' | 'shuffled',
  datasetRoot: '/dataset',
  placeholder: {
    oriImage: '/placeholder/ori.png',
    advImage: '/placeholder/adv.png',
    model: '/placeholder/demo.glb'
  },
  demoMode: true
};
