import type {DropdownMenuProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import type {
  CrossEvent,
  CrossEventType,
} from 'sentry/views/explore/queryParams/crossEvent';

export const crossEventDropdownItems: DropdownMenuProps['items'] = [
  {key: 'spans', label: t('Spans')},
  {key: 'logs', label: t('Logs')},
  {key: 'metrics', label: t('Metrics')},
];

const EMPTY_TRACE_METRIC: TraceMetric = {name: '', type: ''};

export function makeCrossEvent(type: CrossEventType, query = ''): CrossEvent {
  if (type === 'metrics') {
    return {query, type, metric: EMPTY_TRACE_METRIC};
  }
  return {query, type};
}
