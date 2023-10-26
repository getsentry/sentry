import {Sort} from 'sentry/utils/discover/fields';

export type Row = {
  'count()': number;
  'p75(measurements.cls)': number;
  'p75(measurements.fcp)': number;
  'p75(measurements.fid)': number;
  'p75(measurements.lcp)': number;
  'p75(measurements.ttfb)': number;
  transaction: string;
  'transaction.op': string;
};

export type TransactionSampleRow = {
  id: string;
  'measurements.cls': number | null;
  'measurements.fcp': number | null;
  'measurements.fid': number | null;
  'measurements.lcp': number | null;
  'measurements.ttfb': number | null;
  'profile.id': string;
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
  'p75(measurements.cls)',
  'p75(measurements.fcp)',
  'p75(measurements.fid)',
  'p75(measurements.lcp)',
  'p75(measurements.ttfb)',
] as const;

export const DEFAULT_SORT: Sort = {
  kind: 'desc',
  field: 'count()',
};
