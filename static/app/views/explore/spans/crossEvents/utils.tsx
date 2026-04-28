import type {SelectOption} from '@sentry/scraps/compactSelect';

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
    items.push({key: 'metrics', label: t('Application Metrics')});
  }

  return items;
}

export function getCrossEventDatasetOptions(
  organization: Organization
): Array<SelectOption<CrossEventType>> {
  const options: Array<SelectOption<CrossEventType>> = [
    {value: 'spans', label: t('Spans')},
    {value: 'logs', label: t('Logs')},
  ];

  if (canUseMetricsUI(organization)) {
    options.push({value: 'metrics', label: t('Application Metrics')});
  }

  return options;
}

const EMPTY_TRACE_METRIC: TraceMetric = {name: '', type: ''};

export function makeCrossEvent(type: CrossEventType, query = ''): CrossEvent {
  if (type === 'metrics') {
    return {query, type, metric: EMPTY_TRACE_METRIC};
  }
  return {query, type};
}
