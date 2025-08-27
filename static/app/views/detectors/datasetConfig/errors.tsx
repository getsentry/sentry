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
import {parseEventTypesFromQuery} from './eventTypes';

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

const DEFAULT_EVENT_TYPES = ['error', 'default'];

export const DetectorErrorsConfig: DetectorDatasetConfig<ErrorsSeriesResponse> = {
  SearchBar: EventsSearchBar,
  defaultEventTypes: DEFAULT_EVENT_TYPES,
  defaultField: DEFAULT_FIELD,
  getAggregateOptions: () => AGGREGATE_OPTIONS,
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

    const current = snubaQuery.eventTypes;
    const defaultsNormalized = DEFAULT_EVENT_TYPES.toSorted();
    const currentNormalized = current.toSorted();
    const sameAsDefaults =
      currentNormalized.length === defaultsNormalized.length &&
      currentNormalized.every((v, i) => v === defaultsNormalized[i]);

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
    parseEventTypesFromQuery(query, DEFAULT_EVENT_TYPES),
};
