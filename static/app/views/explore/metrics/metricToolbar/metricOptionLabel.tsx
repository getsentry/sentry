import {Tag} from '@sentry/scraps/badge';

import type {TraceMetricTypeValue} from 'sentry/views/explore/metrics/types';

export function MetricTypeBadge({metricType}: {metricType: TraceMetricTypeValue}) {
  if (!metricType) {
    return null;
  }
  return <Tag variant="muted">{metricType}</Tag>;
}
