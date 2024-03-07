import type {Sort} from 'sentry/utils/discover/fields';

export type Row = {
  'count()': number;
  'p75(measurements.cls)': number;
  'p75(measurements.fcp)': number;
  'p75(measurements.fid)': number;
  'p75(measurements.inp)': number;
  'p75(measurements.lcp)': number;
  'p75(measurements.ttfb)': number;
  transaction: string;
};

export type TransactionSampleRow = {
  id: string;
  'profile.id': string;
  projectSlug: string;
  replayId: string;
  timestamp: string;
  transaction: string;
  'user.display': string;
  'measurements.cls'?: number;
  'measurements.fcp'?: number;
  'measurements.fid'?: number;
  'measurements.lcp'?: number;
  'measurements.ttfb'?: number;
  'transaction.duration'?: number;
};

export type TransactionSampleRowWithScore = TransactionSampleRow & Score;

type Score = {
  clsScore: number;
  fcpScore: number;
  fidScore: number;
  inpScore: number;
  lcpScore: number;
  totalScore: number;
  ttfbScore: number;
};

export type ScoreWithWeightsAndOpportunity = Score & Weight & Opportunity;

export type InteractionSpanSampleRow = {
  'measurements.inp': number;
  'profile.id': string;
  projectSlug: string;
  replayId: string;
  'span.op': string;
  'span.self_time': number;
  timestamp: string;
  'user.display': string;
};

export type InteractionSpanSampleRowWithScore = InteractionSpanSampleRow & {
  inpScore: number;
  totalScore: number;
};

export type Weight = {
  clsWeight: number;
  fcpWeight: number;
  fidWeight: number;
  inpWeight: number;
  lcpWeight: number;
  ttfbWeight: number;
};

export type Opportunity = {
  opportunity: number;
};

export type ProjectScore = Partial<Score> & Weight;

export type RowWithScoreAndOpportunity = Row & Score & Opportunity;

export type RowWithScore = Row & Score;

export type WebVitals = 'lcp' | 'fcp' | 'cls' | 'ttfb' | 'fid' | 'inp';

// TODO: Refactor once stored scores are GA'd
export const SORTABLE_SCORE_FIELDS = [
  'totalScore',
  'opportunity',
  'avg(measurements.score.total)',
  'opportunity_score(measurements.score.total)',
];

export const SORTABLE_FIELDS = [
  'count()',
  'p75(measurements.cls)',
  'p75(measurements.fcp)',
  'p75(measurements.fid)',
  'p75(measurements.inp)',
  'p75(measurements.lcp)',
  'p75(measurements.ttfb)',
  ...SORTABLE_SCORE_FIELDS,
] as const;

export const SORTABLE_INDEXED_SCORE_FIELDS = ['totalScore', 'measurements.score.total'];

export const SORTABLE_INDEXED_FIELDS = [
  'measurements.lcp',
  'measurements.fcp',
  'measurements.cls',
  'measurements.ttfb',
  'measurements.fid',
  'measurements.inp',
  ...SORTABLE_INDEXED_SCORE_FIELDS,
] as const;

export const DEFAULT_SORT: Sort = {
  kind: 'desc',
  field: 'count()',
};

export const DEFAULT_INDEXED_SORT: Sort = {
  kind: 'desc',
  field: 'profile.id',
};
