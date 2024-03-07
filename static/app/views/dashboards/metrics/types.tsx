import type {MRI} from 'sentry/types/metrics';
import type {MetricQueryType} from 'sentry/utils/metrics/types';

export type Order = 'asc' | 'desc' | undefined;

export interface DashboardMetricsQuery {
  id: number;
  mri: MRI;
  op: string;
  type: MetricQueryType.QUERY;
  groupBy?: string[];
  isQueryOnly?: boolean;
  limit?: number;
  orderBy?: 'asc' | 'desc';
  query?: string;
}

export interface DashboardMetricsFormula {
  formula: string;
  id: number;
  type: MetricQueryType.FORMULA;
  limit?: number;
  orderBy?: 'asc' | 'desc';
}

export type DashboardMetricsExpression = DashboardMetricsQuery | DashboardMetricsFormula;
