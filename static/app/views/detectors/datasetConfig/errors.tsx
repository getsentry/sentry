import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {EventsStats} from 'sentry/types/organization';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {AggregationKey, FieldKey} from 'sentry/utils/fields';
import {EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {EventsSearchBar} from 'sentry/views/detectors/datasetConfig/components/eventSearchBar';
import {
  getDiscoverSeriesQueryOptions,
  transformEventsStatsComparisonSeries,
  transformEventsStatsToSeries,
} from 'sentry/views/detectors/datasetConfig/utils/discoverSeries';
import {
  BASE_DYNAMIC_INTERVALS,
  BASE_INTERVALS,
  getStandardTimePeriodsForInterval,
} from 'sentry/views/detectors/datasetConfig/utils/timePeriods';
import {
  translateAggregateTag,
  translateAggregateTagBack,
} from 'sentry/views/detectors/datasetConfig/utils/translateAggregateTag';
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

const DEFAULT_EVENT_TYPES = [EventTypes.ERROR, EventTypes.DEFAULT];

export const DetectorErrorsConfig: DetectorDatasetConfig<ErrorsSeriesResponse> = {
  name: t('Errors'),
  SearchBar: EventsSearchBar,
  defaultEventTypes: DEFAULT_EVENT_TYPES,
  defaultField: DEFAULT_FIELD,
  getAggregateOptions: () => AGGREGATE_OPTIONS,
  getSeriesQueryOptions: options => {
    return getDiscoverSeriesQueryOptions({
      ...options,
      dataset: DetectorErrorsConfig.getDiscoverDataset(),
      aggregate: translateAggregateTag(options.aggregate),
    });
  },
  getIntervals: ({detectionType}) => {
    return detectionType === 'dynamic' ? BASE_DYNAMIC_INTERVALS : BASE_INTERVALS;
  },
  getTimePeriods: interval => getStandardTimePeriodsForInterval(interval),
  transformSeriesQueryData: (data, aggregate) => {
    return [transformEventsStatsToSeries(data, aggregate)];
  },
  transformComparisonSeriesData: data => {
    return [transformEventsStatsComparisonSeries(data)];
  },
  fromApiAggregate: aggregate => {
    return translateAggregateTag(aggregate);
  },
  toApiAggregate: aggregate => {
    return translateAggregateTagBack(aggregate);
  },
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
  // TODO: This should use the discover dataset unless `is:unresolved` is in the query
  getDiscoverDataset: () => DiscoverDatasets.ERRORS,
  formatAggregateForTitle: aggregate => {
    if (aggregate === 'count()') {
      return t('Number of errors');
    }
    if (aggregate === 'count_unique(user)') {
      return t('Users experiencing errors');
    }
    return aggregate;
  },
};
