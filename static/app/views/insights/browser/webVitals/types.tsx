import type {ISSUE_TYPE_TO_ISSUE_TITLE} from 'sentry/types/group';
import type {Sort} from 'sentry/utils/discover/fields';
import {SpanIndexedField} from 'sentry/views/insights/types';

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
  'profile.id': string;
  project: string;
  replayId: string;
  [SpanIndexedField.SPAN_DESCRIPTION]: string;
  [SpanIndexedField.SPAN_SELF_TIME]: number;
  [SpanIndexedField.TIMESTAMP]: string;
  [SpanIndexedField.TRACE]: string;
  'user.display'?: string;
  [SpanIndexedField.INP]?: number;
  [SpanIndexedField.CLS]?: number;
  [SpanIndexedField.LCP]?: number;
  [SpanIndexedField.FCP]?: number;
  [SpanIndexedField.TTFB]?: number;
  [SpanIndexedField.LCP_ELEMENT]?: string;
  [SpanIndexedField.SPAN_OP]?: string;
  [SpanIndexedField.CLS_SOURCE]?: string;
};

export type SpanSampleRowWithScore = SpanSampleRow & Score;

export type Opportunity = {
  opportunity: number;
};

export type ProjectScore = Partial<Score>;

export type RowWithScoreAndOpportunity = Row & Score & Opportunity;

export type WebVitals = 'lcp' | 'fcp' | 'cls' | 'ttfb' | 'inp';

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

export const DEFAULT_INDEXED_SORT: Sort = {
  kind: 'desc',
  field: 'profile.id',
};

export const SORTABLE_INDEXED_INTERACTION_FIELDS = [
  SpanIndexedField.INP,
  SpanIndexedField.INP_SCORE,
  SpanIndexedField.INP_SCORE_WEIGHT,
  SpanIndexedField.TOTAL_SCORE,
  SpanIndexedField.SPAN_ID,
  SpanIndexedField.TIMESTAMP,
  SpanIndexedField.PROFILE_ID,
  SpanIndexedField.REPLAY_ID,
  SpanIndexedField.USER,
  SpanIndexedField.ORIGIN_TRANSACTION,
  SpanIndexedField.PROJECT,
  SpanIndexedField.BROWSER_NAME,
  SpanIndexedField.SPAN_SELF_TIME,
  SpanIndexedField.SPAN_DESCRIPTION,
] as const;

export const DEFAULT_INDEXED_SPANS_SORT: Sort = {
  kind: 'desc',
  field: 'timestamp',
};

export const WEB_VITAL_PERFORMANCE_ISSUES: Record<
  WebVitals,
  Array<keyof typeof ISSUE_TYPE_TO_ISSUE_TITLE>
> = {
  lcp: [
    'performance_render_blocking_asset_span',
    'performance_uncompressed_assets',
    'performance_http_overhead',
    'performance_consecutive_http',
    'performance_n_plus_one_api_calls',
    'performance_large_http_payload',
    'performance_p95_endpoint_regression',
  ],
  fcp: [
    'performance_render_blocking_asset_span',
    'performance_uncompressed_assets',
    'performance_http_overhead',
    'performance_consecutive_http',
    'performance_n_plus_one_api_calls',
    'performance_large_http_payload',
    'performance_p95_endpoint_regression',
  ],
  inp: [
    'performance_http_overhead',
    'performance_consecutive_http',
    'performance_n_plus_one_api_calls',
    'performance_large_http_payload',
    'performance_p95_endpoint_regression',
  ],
  cls: [],
  ttfb: ['performance_http_overhead'],
} as const;
