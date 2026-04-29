import type {Sort} from 'sentry/utils/discover/fields';
import {SpanFields} from 'sentry/views/insights/types';

export type Row = {
  'count()': number;
  'p75(measurements.cls)': number;
  'p75(measurements.fcp)': number;
  'p75(measurements.inp)': number;
  'p75(measurements.lcp)': number;
  'p75(measurements.ttfb)': number;
  project: string;
  'project.id': number;
  transaction: string;
};

type TransactionSampleRow = {
  id: string;
  'profile.id': string;
  project: string;
  replayId: string;
  timestamp: string;
  trace: string;
  transaction: string;
  'user.display': string;
  'measurements.cls'?: number;
  'measurements.fcp'?: number;
  'measurements.lcp'?: number;
  'measurements.ttfb'?: number;
  'transaction.duration'?: number;
};

export type TransactionSampleRowWithScore = TransactionSampleRow & Score;

export type Score = {
  clsScore: number;
  fcpScore: number;
  inpScore: number;
  lcpScore: number;
  totalScore: number;
  ttfbScore: number;
};

type SpanSampleRow = {
  id: string;
  'profile.id': string;
  project: string;
  replayId: string;
  [SpanFields.SPAN_DESCRIPTION]: string;
  [SpanFields.SPAN_SELF_TIME]: number;
  [SpanFields.TIMESTAMP]: string;
  [SpanFields.TRACE]: string;
  'user.display'?: string;
  [SpanFields.INP]?: number;
  [SpanFields.CLS]?: number;
  [SpanFields.LCP]?: number;
  [SpanFields.FCP]?: number;
  [SpanFields.TTFB]?: number;
  [SpanFields.LCP_ELEMENT]?: string;
  [SpanFields.SPAN_OP]?: string;
  [SpanFields.CLS_SOURCE]?: string;
};

export type SpanSampleRowWithScore = SpanSampleRow & Score;

export type Opportunity = {
  opportunity: number;
};

export type ProjectScore = Partial<Score>;

export type RowWithScoreAndOpportunity = Row & Score & Opportunity;

export type WebVitals = 'lcp' | 'fcp' | 'cls' | 'ttfb' | 'inp';

export const ORDER: WebVitals[] = ['lcp', 'fcp', 'inp', 'cls', 'ttfb'];

// TODO: Refactor once stored scores are GA'd
const SORTABLE_SCORE_FIELDS = [
  'totalScore',
  'opportunity',
  'avg(measurements.score.total)',
  'opportunity_score(measurements.score.total)',
];

export const SORTABLE_FIELDS = [
  'count()',
  'p75(measurements.cls)',
  'p75(measurements.fcp)',
  'p75(measurements.inp)',
  'p75(measurements.lcp)',
  'p75(measurements.ttfb)',
  ...SORTABLE_SCORE_FIELDS,
] as const;

const SORTABLE_INDEXED_SCORE_FIELDS = [
  'totalScore',
  'measurements.score.total',
  'inpScore',
  'measurements.score.inp',
];

export const SORTABLE_INDEXED_FIELDS = [
  'measurements.lcp',
  'measurements.fcp',
  'measurements.cls',
  'measurements.ttfb',
  'measurements.inp',
  ...SORTABLE_INDEXED_SCORE_FIELDS,
] as const;

export const DEFAULT_SORT: Sort = {
  kind: 'desc',
  field: 'count()',
};

export const SORTABLE_INDEXED_INTERACTION_FIELDS = [
  SpanFields.INP,
  SpanFields.INP_SCORE,
  SpanFields.INP_SCORE_WEIGHT,
  SpanFields.TOTAL_SCORE,
  SpanFields.SPAN_ID,
  SpanFields.TIMESTAMP,
  SpanFields.PROFILE_ID,
  SpanFields.REPLAY_ID,
  SpanFields.USER,
  SpanFields.ORIGIN_TRANSACTION,
  SpanFields.PROJECT,
  SpanFields.BROWSER_NAME,
  SpanFields.SPAN_SELF_TIME,
  SpanFields.SPAN_DESCRIPTION,
] as const;

export const DEFAULT_INDEXED_SPANS_SORT: Sort = {
  kind: 'desc',
  field: 'timestamp',
};
