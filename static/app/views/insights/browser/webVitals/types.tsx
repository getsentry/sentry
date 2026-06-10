import {SpanFields} from 'sentry/views/insights/types';

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
