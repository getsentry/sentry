import type {SelectValue} from 'sentry/types/core';
import type {SessionApiResponse} from 'sentry/types/organization';
import {SessionField} from 'sentry/types/sessions';
import type {
  AggregationKeyWithAlias,
  QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {ReleaseSearchBar} from 'sentry/views/detectors/datasetConfig/components/releaseSearchBar';
import {
  getReleasesSeriesQueryOptions,
  transformMetricsResponseToSeries,
} from 'sentry/views/detectors/datasetConfig/utils/releasesSeries';
import {
  BASE_DYNAMIC_INTERVALS,
  BASE_INTERVALS,
  getStandardTimePeriodsForInterval,
  MetricDetectorInterval,
} from 'sentry/views/detectors/datasetConfig/utils/timePeriods';
import type {FieldValue} from 'sentry/views/discover/table/types';
import {FieldValueKind} from 'sentry/views/discover/table/types';

import type {DetectorDatasetConfig} from './base';
import {parseEventTypesFromQuery} from './eventTypes';

type ReleasesSeriesResponse = SessionApiResponse;

const AGGREGATE_OPTIONS: Readonly<Record<string, SelectValue<FieldValue>>> = {
  'function:crash_free_rate': {
    label: 'crash_free_rate',
    value: {
      kind: FieldValueKind.FUNCTION,
      meta: {
        name: 'crash_free_rate',
        parameters: [
          {
            kind: 'column',
            columnTypes: ['integer', 'string'],
            defaultValue: SessionField.SESSION,
            required: true,
          },
        ],
      },
    },
  },
  'field:session': {
    label: 'session',
    value: {
      kind: FieldValueKind.METRICS,
      meta: {
        name: SessionField.SESSION,
        dataType: 'integer',
      },
    },
  },
  'field:user': {
    label: 'user',
    value: {
      kind: FieldValueKind.METRICS,
      meta: {
        name: SessionField.USER,
        dataType: 'string',
      },
    },
  },
};

// For crash_free_rate, the aggregate we store in the backend is not user friendly so
// we use this mapping to display a more user friendly title.
const AGGREGATE_FUNCTION_MAP: Record<string, string> = {
  'crash_free_rate(session)':
    'percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate',
  'crash_free_rate(user)':
    'percentage(users_crashed, users) AS _crash_rate_alert_aggregate',
};

const DEFAULT_FIELD: QueryFieldValue = {
  function: [
    'crash_free_rate' as AggregationKeyWithAlias,
    SessionField.SESSION,
    undefined,
    undefined,
  ],
  kind: FieldValueKind.FUNCTION,
};

const DEFAULT_EVENT_TYPES: EventTypes[] = [];

const fromApiAggregate = (aggregate: string) => {
  return (
    Object.keys(AGGREGATE_FUNCTION_MAP).find(
      key => AGGREGATE_FUNCTION_MAP[key] === aggregate
    ) ?? aggregate
  );
};

const toApiAggregate = (aggregate: string) => {
  return AGGREGATE_FUNCTION_MAP[aggregate] ?? aggregate;
};

export const DetectorReleasesConfig: DetectorDatasetConfig<ReleasesSeriesResponse> = {
  defaultField: DEFAULT_FIELD,
  defaultEventTypes: DEFAULT_EVENT_TYPES,
  getAggregateOptions: () => AGGREGATE_OPTIONS,
  SearchBar: ReleaseSearchBar,
  getSeriesQueryOptions: options => {
    return getReleasesSeriesQueryOptions({
      ...options,
      dataset: DetectorReleasesConfig.getDiscoverDataset(),
    });
  },
  getIntervals: ({detectionType}) => {
    let intervals = detectionType === 'dynamic' ? BASE_DYNAMIC_INTERVALS : BASE_INTERVALS;
    // Crash-free (releases) does not support sub-hour intervals
    intervals = intervals.filter(interval => interval >= MetricDetectorInterval.ONE_HOUR);
    return intervals;
  },
  getTimePeriods: interval => {
    if (interval < MetricDetectorInterval.ONE_HOUR) {
      return [];
    }
    return getStandardTimePeriodsForInterval(interval);
  },
  toApiAggregate,
  fromApiAggregate,
  toSnubaQueryString: snubaQuery => snubaQuery?.query ?? '',
  separateEventTypesFromQuery: query =>
    parseEventTypesFromQuery(query, DEFAULT_EVENT_TYPES),
  transformSeriesQueryData: (data, aggregate) => {
    return [transformMetricsResponseToSeries(data, aggregate)];
  },
  transformComparisonSeriesData: () => {
    // Releases cannot have a comparison series currently
    return [];
  },
  supportedDetectionTypes: ['static'],
  getDiscoverDataset: () => DiscoverDatasets.METRICS,
};
