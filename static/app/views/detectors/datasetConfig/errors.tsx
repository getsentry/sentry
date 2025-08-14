import type {SelectValue} from 'sentry/types/core';
import type {EventsStats} from 'sentry/types/organization';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {AggregationKey, FieldKey} from 'sentry/utils/fields';
import {EventsSearchBar} from 'sentry/views/detectors/datasetConfig/components/eventSearchBar';
import {
  getDiscoverSeriesQueryOptions,
  transformEventsStatsComparisonSeries,
  transformEventsStatsToSeries,
} from 'sentry/views/detectors/datasetConfig/utils/discoverSeries';
import {FieldValueKind, type FieldValue} from 'sentry/views/discover/table/types';

import type {DetectorDatasetConfig} from './base';
import {DEFAULT_EVENT_TYPES_BY_DATASET, parseEventTypesFromQuery} from './eventTypes';
import {DetectorDataset} from './types';

type ErrorsSeriesResponse = EventsStats;

const AGGREGATE_OPTIONS: Record<string, SelectValue<FieldValue>> = {
  'function:count': {
    label: 'count',
    value: {
      kind: FieldValueKind.FUNCTION,
      meta: {
        name: 'count',
        parameters: [],
      },
    },
  },
  'function:count_unique': {
    label: 'count_unique',
    value: {
      kind: FieldValueKind.FUNCTION,
      meta: {
        name: 'count_unique',
        parameters: [
          {
            kind: 'column',
            columnTypes: ['string'],
            defaultValue: FieldKey.USER,
            required: true,
          },
        ],
      },
    },
  },
  'field:user': {
    label: 'user',
    value: {
      kind: FieldValueKind.FIELD,
      meta: {
        name: FieldKey.USER,
        dataType: 'string',
      },
    },
  },
};

const DEFAULT_FIELD: QueryFieldValue = {
  function: [AggregationKey.COUNT, '', undefined, undefined],
  kind: FieldValueKind.FUNCTION,
};

export const DetectorErrorsConfig: DetectorDatasetConfig<ErrorsSeriesResponse> = {
  defaultField: DEFAULT_FIELD,
  getAggregateOptions: () => AGGREGATE_OPTIONS,
  SearchBar: EventsSearchBar,
  getSeriesQueryOptions: options =>
    getDiscoverSeriesQueryOptions({
      ...options,
      dataset: DiscoverDatasets.ERRORS,
    }),
  transformSeriesQueryData: (data, aggregate) => {
    return [transformEventsStatsToSeries(data, aggregate)];
  },
  transformComparisonSeriesData: data => {
    return [transformEventsStatsComparisonSeries(data)];
  },
  fromApiAggregate: aggregate => aggregate,
  toApiAggregate: aggregate => aggregate,
  supportedDetectionTypes: ['static', 'percent', 'dynamic'],
  toSnubaQueryString: snubaQuery => {
    if (!snubaQuery) {
      return '';
    }

    const defaultsSorted =
      DEFAULT_EVENT_TYPES_BY_DATASET[DetectorDataset.ERRORS].toSorted();
    const current = snubaQuery.eventTypes;
    const sameAsDefaults =
      current.length === defaultsSorted.length &&
      current.toSorted().every((v, i) => v === defaultsSorted[i]);

    let eventTypeFilter = '';
    if (!sameAsDefaults) {
      if (current.length === 1) {
        eventTypeFilter = `event.type:${current[0]}`;
      } else if (current.length > 1) {
        eventTypeFilter = `event.type:[${current.join(', ')}]`;
      }
    }

    return [eventTypeFilter, snubaQuery.query].filter(Boolean).join(' ');
  },
  separateEventTypesFromQuery: query =>
    parseEventTypesFromQuery(
      query,
      DEFAULT_EVENT_TYPES_BY_DATASET[DetectorDataset.ERRORS]
    ),
};
