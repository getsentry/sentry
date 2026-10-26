import type {SelectOption} from '@sentry/scraps/compactSelect';

import type {TraceMetricTypeValue} from 'sentry/views/explore/metrics/types';

export interface MetricSelectorOption extends SelectOption<string> {
  kind: 'metric';
  metricName: string;
  metricType: TraceMetricTypeValue;
  count?: number;
  lastSeen?: number;
  metricUnit?: string | null;
  tooltip?: string;
}

interface FieldSelectorOption extends SelectOption<string> {
  kind: 'field';
  textValue: string;
  tooltip?: string;
}

export type MetricSelectorItem = MetricSelectorOption | FieldSelectorOption;

export function isMetricSelectorOption(
  option: MetricSelectorItem
): option is MetricSelectorOption {
  return option.kind === 'metric';
}
