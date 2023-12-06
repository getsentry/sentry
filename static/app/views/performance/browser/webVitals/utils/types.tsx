import {Sort} from 'sentry/utils/discover/fields';

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
  browser: string;
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
  'transaction.op': string;
  'user.display': string;
};

export type Score = {
  clsScore: number;
  fcpScore: number;
  fidScore: number;
  lcpScore: number;
  score: number;
  ttfbScore: number;
};

export type RowWithScore = Row & Score;

export type TransactionSampleRowWithScore = TransactionSampleRow & Score;

export type WebVitals = 'lcp' | 'fcp' | 'cls' | 'ttfb' | 'fid';

export const SORTABLE_FIELDS = [
  'count()',
  'avg(measurements.cls)',
  'avg(measurements.fcp)',
  'avg(measurements.fid)',
  'avg(measurements.lcp)',
  'avg(measurements.ttfb)',
  'avg(measurements.score.total)',
] as const;

export const SORTABLE_INDEXED_FIELDS = [
  'measurements.lcp',
  'measurements.fcp',
  'measurements.cls',
  'measurements.ttfb',
  'measurements.fid',
] as const;

export const DEFAULT_SORT: Sort = {
  kind: 'desc',
  field: 'count()',
};

export const DEFAULT_INDEXED_SORT: Sort = {
  kind: 'desc',
  field: 'profile.id',
};
