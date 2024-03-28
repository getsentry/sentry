import type {MRI} from 'sentry/types/metrics';
import type {MetricExpressionType} from 'sentry/utils/metrics/types';

export type Order = 'asc' | 'desc' | undefined;

export interface DashboardMetricsQuery {
  id: number;
  isHidden: boolean;
  mri: MRI;
  op: string;
  orderBy: Order;
  type: MetricExpressionType.QUERY;
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
}

export type DashboardMetricsExpression = DashboardMetricsQuery | DashboardMetricsEquation;
