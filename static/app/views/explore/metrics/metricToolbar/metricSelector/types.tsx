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

interface FreeformSelectorOption extends SelectOption<string> {
  kind: 'freeform';
  metricName: string;
  textValue: string;
  tooltip?: string;
}

export type FreeformDataType = 'string' | 'number' | 'boolean';

interface FreeformDataTypeSelectorOption extends SelectOption<string> {
  dataType: FreeformDataType;
  kind: 'freeformDataType';
  textValue: string;
  tooltip?: string;
}

export type MetricSelectorItem =
  | MetricSelectorOption
  | FieldSelectorOption
  | FreeformSelectorOption
  | FreeformDataTypeSelectorOption;

export function isMetricSelectorOption(
  option: MetricSelectorItem
): option is MetricSelectorOption {
  return option.kind === 'metric';
}
