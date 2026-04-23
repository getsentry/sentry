import type {DropdownMenuProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {canUseMetricsUI} from 'sentry/views/explore/metrics/metricsFlags';
import type {
  CrossEvent,
  CrossEventType,
} from 'sentry/views/explore/queryParams/crossEvent';

export function getCrossEventDropdownItems(
  organization: Organization
): DropdownMenuProps['items'] {
  const items: DropdownMenuProps['items'] = [
    {key: 'spans', label: t('Spans')},
    {key: 'logs', label: t('Logs')},
  ];

  if (canUseMetricsUI(organization)) {
    items.push({key: 'metrics', label: t('Metrics')});
  }

  return items;
}

const EMPTY_TRACE_METRIC: TraceMetric = {name: '', type: ''};

export function makeCrossEvent(type: CrossEventType, query = ''): CrossEvent {
  if (type === 'metrics') {
    return {query, type, metric: EMPTY_TRACE_METRIC};
  }
  return {query, type};
}
