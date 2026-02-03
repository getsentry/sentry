import {Tag} from '@sentry/scraps/badge/tag';
import {Flex} from '@sentry/scraps/layout';

import type {TraceMetricTypeValue} from 'sentry/views/explore/metrics/types';

export function MetricTypeBadge({metricType}: {metricType: TraceMetricTypeValue}) {
  if (!metricType) {
    return null;
  }
  return <Tag variant="muted">{metricType}</Tag>;
}

interface MetricOptionLabelProps {
  label: string;
  metricType?: TraceMetricTypeValue;
}

export function MetricOptionLabel({label, metricType}: MetricOptionLabelProps) {
  return (
    <Flex gap="sm" align="center">
      <span>{label}</span>
      {metricType ? <MetricTypeBadge metricType={metricType} /> : null}
    </Flex>
  );
}
