import type {SelectOption} from '@sentry/scraps/compactSelect';

import type {DropdownMenuProps} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import type {
  CrossEvent,
  CrossEventType,
} from 'sentry/views/explore/queryParams/crossEvent';
import type {CrossEventDatasetAvailability} from 'sentry/views/explore/spans/crossEvents/useCrossEventDatasetAvailability';

export function getCrossEventDropdownItems(
  availability: CrossEventDatasetAvailability
): DropdownMenuProps['items'] {
  const items: DropdownMenuProps['items'] = [{key: 'spans', label: t('Spans')}];

  if (availability.logs) {
    items.push({key: 'logs', label: t('Logs')});
  }

  if (availability.metrics) {
    items.push({key: 'metrics', label: t('Application Metrics')});
  }

  return items;
}

export function getCrossEventDatasetOptions(
  availability: CrossEventDatasetAvailability
): Array<SelectOption<CrossEventType>> {
  const options: Array<SelectOption<CrossEventType>> = [
    {value: 'spans', label: t('Spans')},
  ];

  if (availability.logs) {
    options.push({value: 'logs', label: t('Logs')});
  }

  if (availability.metrics) {
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
