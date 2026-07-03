import { datasetConfig } from '../data/datasetConfig';
import { demoBatches } from '../data/batchGenerator';
import type { Batch, DatasetSummary } from '../types/dataset';
import { pickRandomIndex } from '../utils/random';
import { readLastBatchIndex, saveLastBatchIndex } from '../utils/storage';

async function getServerJson<T>(path: string): Promise<T | undefined> {
  try {
    const response = await fetch(path, { headers: { Accept: 'application/json' } });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('application/json')) return undefined;
    return (await response.json()) as T;
  } catch {
    return undefined;
  }
}

export async function getDatasetSummary(): Promise<DatasetSummary> {
  const serverSummary = await getServerJson<DatasetSummary>('/api/summary');
  if (serverSummary) return serverSummary;

  return {
    categoryCount: datasetConfig.categories.length,
    samplesPerCategory: datasetConfig.samplesPerCategory,
    totalSamples: datasetConfig.categories.length * datasetConfig.samplesPerCategory,
    samplesPerBatch: datasetConfig.samplesPerBatch,
    totalBatches: demoBatches.length,
    batchMode: datasetConfig.batchMode,
    demoMode: datasetConfig.demoMode
  };
}

export async function getBatches(): Promise<Batch[]> {
  const serverBatches = await getServerJson<Batch[]>('/api/batches');
  if (serverBatches) return serverBatches;
  return demoBatches;
}

export async function getBatch(batchId: string): Promise<Batch | undefined> {
  const serverBatch = await getServerJson<Batch>(`/api/batch/${encodeURIComponent(batchId)}`);
  if (serverBatch) return serverBatch;
  return demoBatches.find((batch) => batch.batchId === batchId);
}

export async function getRandomBatch(): Promise<Batch> {
  const last = readLastBatchIndex();
  const exclude = last === undefined ? '' : `?exclude=batch_${last.toString().padStart(3, '0')}`;
  const serverBatch = await getServerJson<Batch>(`/api/batch/random${exclude}`);
  if (serverBatch) {
    saveLastBatchIndex(serverBatch.batchIndex);
    return serverBatch;
  }

  const index = pickRandomIndex(demoBatches.length, last);
  saveLastBatchIndex(index);
  return demoBatches[index];
}
