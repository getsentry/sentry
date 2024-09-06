import type {DateString} from 'sentry/types/core';
import type {MetricAggregation, MRI} from 'sentry/types/metrics';

export enum MetricDisplayType {
  LINE = 'line',
  AREA = 'area',
  BAR = 'bar',
}

export type MetricTag = {
  key: string;
};

export type SortState = {
  name: 'name' | MetricAggregation | undefined;
  order: 'asc' | 'desc';
};

export enum MetricSeriesFilterUpdateType {
  ADD = 'add',
  EXCLUDE = 'exclude',
}

export interface FocusedMetricsSeries {
  id: string;
  groupBy?: Record<string, string>;
}

export interface MetricsQuery {
  aggregation: MetricAggregation;
  mri: MRI;
  condition?: number;
  groupBy?: string[];
  query?: string;
}

export enum MetricExpressionType {
  QUERY = 1,
  EQUATION = 2,
}

export enum MetricChartOverlayType {
  RELEASES = 'releases',
  SAMPLES = 'samples',
}

export interface BaseWidgetParams {
  displayType: MetricDisplayType;
  id: number;
  isHidden: boolean;
  type: MetricExpressionType;
  focusedSeries?: FocusedMetricsSeries[];
  overlays?: MetricChartOverlayType[];
  sort?: SortState;
}

export interface MetricsQueryWidget extends BaseWidgetParams, MetricsQuery {
  type: MetricExpressionType.QUERY;
  powerUserMode?: boolean;
}

export interface MetricsEquationWidget extends BaseWidgetParams {
  formula: string;
  type: MetricExpressionType.EQUATION;
}

export type MetricsWidget = MetricsQueryWidget | MetricsEquationWidget;

export function isMetricsEquationWidget(
  widget: MetricsWidget
): widget is MetricsEquationWidget {
  return widget.type === MetricExpressionType.EQUATION;
}

export function isMetricsQueryWidget(
  widget: MetricsWidget
): widget is MetricsQueryWidget {
  return widget.type === MetricExpressionType.QUERY;
}

export interface MetricsQueryParams {
  widgets: string; // stringified json representation of MetricsWidget
  end?: DateString;
  environment?: string[];
  interval?: string;
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
