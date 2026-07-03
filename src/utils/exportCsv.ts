import type { BatchSubmission } from '../types/rating';

function csvEscape(value: unknown): string {
  if (value === undefined || value === null) return '';
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function submissionsToCsv(submissions: BatchSubmission[]): string {
  const headers = [
    'submission_id',
    'session_id',
    'user_id',
    'batch_id',
    'sample_id',
    'category',
    'sample_index',
    'image_similarity_same',
    'selected_original_image',
    'original_confidence',
    'visual_stealthiness',
    'attack_effectiveness',
    'comment',
    'started_at',
    'submitted_at'
  ];

  const rows = submissions.flatMap((submission) =>
    submission.ratings.map((rating) => [
      submission.submissionId,
      submission.sessionId,
      submission.userId || '',
      submission.batchId,
      rating.sampleId,
      rating.category,
      rating.sampleIndex,
      rating.imageSimilaritySame === undefined ? '' : rating.imageSimilaritySame ? 'yes' : 'no',
      rating.selectedOriginalImage || '',
      rating.originalConfidence ?? '',
      rating.visualStealthiness ?? '',
      rating.attackEffectiveness,
      rating.comment || '',
      rating.startedAt,
      submission.submittedAt
    ])
  );

  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

export function downloadText(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
