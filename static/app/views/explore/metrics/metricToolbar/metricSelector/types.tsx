import type {MenuListItemProps} from '@sentry/scraps/menuListItem';

import type {TraceMetricTypeValue} from 'sentry/views/explore/metrics/types';

export interface MetricSelectOption {
  label: string;
  metricName: string;
  metricType: TraceMetricTypeValue;
  value: string;
  count?: number;
  lastSeen?: number;
  metricUnit?: string;
  trailingItems?: MenuListItemProps['trailingItems'];
}
