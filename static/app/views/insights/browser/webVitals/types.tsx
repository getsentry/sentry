import type {Sort} from 'sentry/utils/discover/fieldsBase';
import {SpanFields} from 'sentry/views/insights/types';

export const WEB_VITAL_TO_FIELD = {
  lcp: SpanFields.BROWSER_WEB_VITAL_LCP_VALUE,
  fcp: SpanFields.BROWSER_WEB_VITAL_FCP_VALUE,
  cls: SpanFields.BROWSER_WEB_VITAL_CLS_VALUE,
  ttfb: SpanFields.BROWSER_WEB_VITAL_TTFB_VALUE,
  inp: SpanFields.BROWSER_WEB_VITAL_INP_VALUE,
} as const;

export type Row = {
  'count()': number;
  'p75(browser.web_vital.cls.value)': number;
  'p75(browser.web_vital.fcp.value)': number;
  'p75(browser.web_vital.inp.value)': number;
  'p75(browser.web_vital.lcp.value)': number;
  'p75(browser.web_vital.ttfb.value)': number;
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
  [SpanFields.BROWSER_WEB_VITAL_CLS_VALUE]?: number;
  [SpanFields.BROWSER_WEB_VITAL_FCP_VALUE]?: number;
  [SpanFields.BROWSER_WEB_VITAL_LCP_VALUE]?: number;
  [SpanFields.BROWSER_WEB_VITAL_TTFB_VALUE]?: number;
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
  [SpanFields.BROWSER_WEB_VITAL_INP_VALUE]?: number;
  [SpanFields.BROWSER_WEB_VITAL_CLS_VALUE]?: number;
  [SpanFields.BROWSER_WEB_VITAL_LCP_VALUE]?: number;
  [SpanFields.BROWSER_WEB_VITAL_FCP_VALUE]?: number;
  [SpanFields.BROWSER_WEB_VITAL_TTFB_VALUE]?: number;
  [SpanFields.BROWSER_WEB_VITAL_LCP_ELEMENT]?: string;
  [SpanFields.SPAN_OP]?: string;
  [SpanFields.BROWSER_WEB_VITAL_CLS_SOURCE_1]?: string;
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
  `p75(${SpanFields.BROWSER_WEB_VITAL_CLS_VALUE})`,
  `p75(${SpanFields.BROWSER_WEB_VITAL_FCP_VALUE})`,
  `p75(${SpanFields.BROWSER_WEB_VITAL_INP_VALUE})`,
  `p75(${SpanFields.BROWSER_WEB_VITAL_LCP_VALUE})`,
  `p75(${SpanFields.BROWSER_WEB_VITAL_TTFB_VALUE})`,
  ...SORTABLE_SCORE_FIELDS,
] as const;

const SORTABLE_INDEXED_SCORE_FIELDS = [
  'totalScore',
  'measurements.score.total',
  'inpScore',
  'measurements.score.inp',
];

export const SORTABLE_INDEXED_FIELDS = [
  SpanFields.BROWSER_WEB_VITAL_LCP_VALUE,
  SpanFields.BROWSER_WEB_VITAL_FCP_VALUE,
  SpanFields.BROWSER_WEB_VITAL_CLS_VALUE,
  SpanFields.BROWSER_WEB_VITAL_TTFB_VALUE,
  SpanFields.BROWSER_WEB_VITAL_INP_VALUE,
  ...SORTABLE_INDEXED_SCORE_FIELDS,
] as const;

export const DEFAULT_SORT: Sort = {
  kind: 'desc',
  field: 'count()',
};

export const SORTABLE_INDEXED_INTERACTION_FIELDS = [
  SpanFields.BROWSER_WEB_VITAL_INP_VALUE,
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
