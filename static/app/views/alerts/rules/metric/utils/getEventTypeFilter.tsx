import {convertDatasetEventTypesToSource} from 'sentry/views/alerts/utils';

import {DATASET_EVENT_TYPE_FILTERS, DATASOURCE_EVENT_TYPE_FILTERS} from '../constants';
import {Dataset, Datasource, EventTypes, MetricRule} from '../types';

export function extractEventTypeFilterFromRule(metricRule: MetricRule): string {
  const {dataset, eventTypes} = metricRule;
  return getEventTypeFilter(dataset, eventTypes);
}

export function getEventTypeFilter(
  dataset: Dataset,
  eventTypes: EventTypes[] | undefined
): string {
  if (eventTypes) {
    return DATASOURCE_EVENT_TYPE_FILTERS[
      convertDatasetEventTypesToSource(dataset, eventTypes) ?? Datasource.ERROR
    ];
  }
  return DATASET_EVENT_TYPE_FILTERS[dataset ?? Dataset.ERRORS];
}
