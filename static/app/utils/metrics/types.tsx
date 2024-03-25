import type {DateString, MRI} from 'sentry/types';

export enum MetricDisplayType {
  LINE = 'line',
  AREA = 'area',
  BAR = 'bar',
}

export type MetricTag = {
  key: string;
};

export type SortState = {
  name: 'name' | 'avg' | 'min' | 'max' | 'sum' | 'total' | undefined;
  order: 'asc' | 'desc';
};

export interface FocusedMetricsSeries {
  id: string;
  groupBy?: Record<string, string>;
}

export interface MetricsQuery {
  mri: MRI;
  op: string;
  groupBy?: string[];
  query?: string;
}

export enum MetricQueryType {
  QUERY = 1,
  FORMULA = 2,
}

export interface BaseWidgetParams {
  displayType: MetricDisplayType;
  id: number;
  isHidden: boolean;
  type: MetricQueryType;
  focusedSeries?: FocusedMetricsSeries[];
  sort?: SortState;
}

export interface MetricQueryWidgetParams extends BaseWidgetParams, MetricsQuery {
  type: MetricQueryType.QUERY;
  powerUserMode?: boolean;
}

export interface MetricFormulaWidgetParams extends BaseWidgetParams {
  formula: string;
  type: MetricQueryType.FORMULA;
}

export type MetricWidgetQueryParams = MetricQueryWidgetParams | MetricFormulaWidgetParams;

export interface DdmQueryParams {
  widgets: string; // stringified json representation of MetricWidgetQueryParams
  end?: DateString;
  environment?: string[];
  project?: number[];
  start?: DateString;
  statsPeriod?: string | null;
  utc?: boolean | null;
}

export type MetricCodeLocationFrame = {
  absPath?: string;
  contextLine?: string;
  filename?: string;
  function?: string;
  lineNo?: number;
  module?: string;
  platform?: string;
  postContext?: string[];
  preContext?: string[];
};

export type MetricMetaCodeLocation = {
  mri: string;
  timestamp: number;
  codeLocations?: MetricCodeLocationFrame[];
  frames?: MetricCodeLocationFrame[];
  metricSpans?: MetricCorrelation[];
};

export interface MetricSummary {
  spanId: string;
  count?: number;
  max?: number;
  min?: number;
  sum?: number;
}

export interface SpanSummary {
  spanDuration: number;
  spanOp: string;
}

export type MetricCorrelation = {
  duration: number;
  metricSummaries: MetricSummary[];
  profileId: string;
  projectId: number;
  segmentName: string;
  spansDetails: {
    spanDuration: number;
    spanId: string;
    spanTimestamp: string;
  }[];
  spansNumber: number;
  timestamp: string;
  traceId: string;
  transactionId: string;
  transactionSpanId: string;
  spansSummary?: {
    spanDuration: number;
    spanOp: string;
  }[];
};
