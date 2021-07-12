import {convertDatasetEventTypesToSource} from 'app/views/alerts/utils';

import {DATASET_EVENT_TYPE_FILTERS, DATASOURCE_EVENT_TYPE_FILTERS} from '../constants';
import {Dataset, Datasource, EventTypes, IncidentRule} from '../types';

export function extractEventTypeFilterFromRule(metricRule: IncidentRule) {
  const {dataset, eventTypes} = metricRule;
  return getEventTypeFilter(dataset, eventTypes);
}

export function getEventTypeFilter(
  dataset: Dataset,
  eventTypes: EventTypes[] | undefined
) {
  if (eventTypes) {
    return DATASOURCE_EVENT_TYPE_FILTERS[
      convertDatasetEventTypesToSource(dataset, eventTypes) ?? Datasource.ERROR
    ];
  } else {
    return DATASET_EVENT_TYPE_FILTERS[dataset ?? Dataset.ERRORS];
  }
}
