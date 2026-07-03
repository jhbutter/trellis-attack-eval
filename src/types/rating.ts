export type RatingValue = number | undefined;

export type SampleRatingDraft = {
  visualStealthiness?: number;
  attackEffectiveness?: number;
  comment?: string;
  updatedAt?: string;
};

export type Rating = {
  ratingId: string;
  userId?: string;
  batchId: string;
  sampleId: string;
  category: string;
  sampleIndex: number;
  visualStealthiness: number;
  attackEffectiveness: number;
  comment?: string;
  startedAt: string;
  submittedAt?: string;
  userAgent?: string;
  sessionId?: string;
};

export type BatchSubmission = {
  submissionId: string;
  userId?: string;
  sessionId: string;
  batchId: string;
  ratings: Rating[];
  completedCount: number;
  totalCount: number;
  startedAt: string;
  submittedAt: string;
};
