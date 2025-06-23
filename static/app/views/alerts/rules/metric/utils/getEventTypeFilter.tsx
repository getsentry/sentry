import {
  DATASET_EVENT_TYPE_FILTERS,
  DATASOURCE_EVENT_TYPE_FILTERS,
} from 'sentry/views/alerts/rules/metric/constants';
import type {EventTypes, MetricRule} from 'sentry/views/alerts/rules/metric/types';
import {Dataset, Datasource} from 'sentry/views/alerts/rules/metric/types';
import {convertDatasetEventTypesToSource} from 'sentry/views/alerts/utils';

export function extractEventTypeFilterFromRule(metricRule: MetricRule): string {
  const {dataset, eventTypes} = metricRule;
  return getEventTypeFilter(dataset, eventTypes);
}

export function getEventTypeFilter(
  dataset: Dataset,
  eventTypes: EventTypes[] | undefined
): string {
  if (dataset === Dataset.EVENTS_ANALYTICS_PLATFORM) {
    return '';
  }
  if (eventTypes) {
    return DATASOURCE_EVENT_TYPE_FILTERS[
      convertDatasetEventTypesToSource(dataset, eventTypes) ?? Datasource.ERROR
    ];
  }
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return DATASET_EVENT_TYPE_FILTERS[dataset ?? Dataset.ERRORS];
}
