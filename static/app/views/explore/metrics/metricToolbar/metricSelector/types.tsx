import type {SelectOption} from '@sentry/scraps/compactSelect';

import type {TraceMetricTypeValue} from 'sentry/views/explore/metrics/types';

export interface MetricSelectOption extends SelectOption<string> {
  metricName: string;
  metricType: TraceMetricTypeValue;
  count?: number;
  lastSeen?: number;
  metricUnit?: string;
}
