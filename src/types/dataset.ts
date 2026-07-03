export type CategoryId =
  | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7' | 'A8' | 'A9' | 'A10'
  | 'B1' | 'B2' | 'B3' | 'B4' | 'B5' | 'B6';

export type Sample = {
  sampleId: string;
  category: CategoryId;
  index: number;
  batchId: string;
  files: {
    oriImage: string;
    advImage: string;
    gtModel: string;
    reconOriModel: string;
    reconAdvModel: string;
  };
  metadata?: {
    objectName?: string;
    sourceDataset?: string;
    attackMethod?: string;
    epsilon?: number;
    trellisConfig?: string;
    notes?: string;
  };
};

export type Batch = {
  batchId: string;
  batchIndex: number;
  samples: Sample[];
};

export type DatasetSummary = {
  categoryCount: number;
  samplesPerCategory: number;
  totalSamples: number;
  samplesPerBatch: number;
  totalBatches: number;
  batchMode: 'sequential' | 'shuffled';
  demoMode: boolean;
};
