import {Sort} from 'sentry/utils/discover/fields';
import {USE_STORED_SCORES} from 'sentry/views/performance/browser/webVitals/settings';

export type Row = {
  'avg(measurements.cls)': number;
  'avg(measurements.fcp)': number;
  'avg(measurements.fid)': number;
  'avg(measurements.lcp)': number;
  'avg(measurements.ttfb)': number;
  'count()': number;
  transaction: string;
};

export type TransactionSampleRow = {
  id: string;
  'measurements.cls': number | null;
  'measurements.fcp': number | null;
  'measurements.fid': number | null;
  'measurements.lcp': number | null;
  'measurements.ttfb': number | null;
  'profile.id': string;
  projectSlug: string;
  replayId: string;
  timestamp: string;
  transaction: string;
  'transaction.duration': number | null;
  'user.display': string;
};

export type Score = {
  clsScore: number;
  fcpScore: number;
  fidScore: number;
  lcpScore: number;
  score: number;
  ttfbScore: number;
  opportunity?: number;
};

export type RowWithScore = Row & Score;

export type TransactionSampleRowWithScore = TransactionSampleRow & Score;

export type WebVitals = 'lcp' | 'fcp' | 'cls' | 'ttfb' | 'fid';

// TODO: These arrays have conditional elements that need to be refactored once stored scores are GA'd
export const SORTABLE_FIELDS = [
  'count()',
  'avg(measurements.cls)',
  'avg(measurements.fcp)',
  'avg(measurements.fid)',
  'avg(measurements.lcp)',
  'avg(measurements.ttfb)',
  ...(USE_STORED_SCORES
    ? [
        'score',
        'opportunity',
        'avg(measurements.score.total)',
        'opportunity_score(measurements.score.total)',
      ]
    : []),
] as const;

export const SORTABLE_INDEXED_FIELDS = [
  'measurements.lcp',
  'measurements.fcp',
  'measurements.cls',
  'measurements.ttfb',
  'measurements.fid',
  ...(USE_STORED_SCORES ? ['score', 'measurements.score.total'] : []),
] as const;

export const DEFAULT_SORT: Sort = {
  kind: 'desc',
  field: 'count()',
};

export const DEFAULT_INDEXED_SORT: Sort = {
  kind: 'desc',
  field: 'profile.id',
};
