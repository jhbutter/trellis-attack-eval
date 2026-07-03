import { datasetConfig } from './datasetConfig';
import type { Batch, Sample } from '../types/dataset';
import { stableShuffle } from '../utils/random';

function paddedIndex(index: number): string {
  return index.toString().padStart(4, '0');
}

export function generateSamples(): Sample[] {
  const rawSamples: Omit<Sample, 'batchId'>[] = [];

  for (const category of datasetConfig.categories) {
    for (let index = 1; index <= datasetConfig.samplesPerCategory; index += 1) {
      const id = paddedIndex(index);
      const sampleId = `${category}_${id}`;
      const root = `${datasetConfig.datasetRoot}/${category}/${id}`;
      rawSamples.push({
        sampleId,
        category,
        index,
        files: {
          oriImage: `${root}/ori.png`,
          advImage: `${root}/adv.png`,
          gtModel: `${root}/gt.glb`,
          reconOriModel: `${root}/recon_ori.glb`,
          reconAdvModel: `${root}/recon_adv.glb`
        },
        metadata: {
          objectName: `Demo object ${sampleId}`,
          sourceDataset: 'Demo placeholder. Replace public/dataset with real Trellis evaluation assets.',
          attackMethod: 'Demo attack placeholder',
          epsilon: 8 / 255,
          trellisConfig: 'single-image reconstruction demo config',
          notes: 'This sample is generated from metadata only. Missing files fall back to placeholder assets.'
        }
      });
    }
  }

  return rawSamples.map((sample, order) => {
    const batchIndex = Math.floor(order / datasetConfig.samplesPerBatch) + 1;
    return { ...sample, batchId: `batch_${batchIndex.toString().padStart(3, '0')}` };
  });
}

export function generateBatches(mode = datasetConfig.batchMode): Batch[] {
  const samples = generateSamples();
  const orderedSamples = mode === 'shuffled' ? stableShuffle(samples) : samples;

  const batches: Batch[] = [];
  for (let offset = 0; offset < orderedSamples.length; offset += datasetConfig.samplesPerBatch) {
    const batchIndex = Math.floor(offset / datasetConfig.samplesPerBatch) + 1;
    const batchId = `batch_${batchIndex.toString().padStart(3, '0')}`;
    const chunk = orderedSamples.slice(offset, offset + datasetConfig.samplesPerBatch).map((sample) => ({
      ...sample,
      batchId
    }));
    batches.push({ batchId, batchIndex, samples: chunk });
  }
  return batches;
}

export const demoBatches = generateBatches();
