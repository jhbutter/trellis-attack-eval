import type { BatchSubmission } from '../types/rating';
import { appendSubmission, readSubmissions } from '../utils/storage';
import { isSupabaseEnabled, supabase } from './supabaseClient';

type SubmissionMode = 'server' | 'local' | 'supabase';

async function serverJson<T>(path: string, init?: RequestInit): Promise<T | undefined> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers || {})
      }
    });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('application/json')) return undefined;
    return (await response.json()) as T;
  } catch {
    return undefined;
  }
}

export async function submitBatchSubmission(submission: BatchSubmission): Promise<{ ok: boolean; mode: SubmissionMode; error?: string }> {
  appendSubmission(submission);

  const serverResult = await serverJson<{ ok: boolean; error?: string }>('/api/submissions', {
    method: 'POST',
    body: JSON.stringify(submission)
  });
  if (serverResult?.ok) {
    return { ok: true, mode: 'server' };
  }

  if (!isSupabaseEnabled || !supabase) {
    return {
      ok: true,
      mode: 'local',
      error: serverResult?.error || 'server API unavailable; saved to this browser only'
    };
  }

  const { error } = await supabase.from('ratings_submissions').insert({
    submission_id: submission.submissionId,
    session_id: submission.sessionId,
    user_id: submission.userId || null,
    batch_id: submission.batchId,
    completed_count: submission.completedCount,
    total_count: submission.totalCount,
    started_at: submission.startedAt,
    submitted_at: submission.submittedAt,
    payload: submission
  });

  if (error) {
    return { ok: false, mode: 'supabase', error: error.message };
  }
  return { ok: true, mode: 'supabase' };
}

export async function getLocalSubmissions(): Promise<BatchSubmission[]> {
  const serverSubmissions = await serverJson<BatchSubmission[]>('/api/submissions');
  if (serverSubmissions) return serverSubmissions;
  return readSubmissions();
}
