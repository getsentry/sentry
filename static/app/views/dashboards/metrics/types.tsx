import type {MetricAggregation, MRI} from 'sentry/types/metrics';
import type {MetricExpressionType} from 'sentry/utils/metrics/types';

export type Order = 'asc' | 'desc' | undefined;

export interface DashboardMetricsQuery {
  aggregation: MetricAggregation;
  id: number;
  isHidden: boolean;
  mri: MRI;
  orderBy: Order;
  type: MetricExpressionType.QUERY;
  alias?: string;
  condition?: number;
  groupBy?: string[];
  isQueryOnly?: boolean;
  limit?: number;
  query?: string;
}

export interface DashboardMetricsEquation {
  formula: string;
  id: number;
  isHidden: boolean;
  type: MetricExpressionType.EQUATION;
  alias?: string;
  isQueryOnly?: boolean;
}

export type DashboardMetricsExpression = DashboardMetricsQuery | DashboardMetricsEquation;
