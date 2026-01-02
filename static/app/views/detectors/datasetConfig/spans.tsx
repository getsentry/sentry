import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import type {EventsStats, Organization} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {AggregateParameter} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {AggregationKey, getFieldDefinition} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import {TraceSearchBar} from 'sentry/views/detectors/datasetConfig/components/traceSearchBar';
import {
  getDiscoverSeriesQueryOptions,
  transformEventsStatsComparisonSeries,
  transformEventsStatsToSeries,
} from 'sentry/views/detectors/datasetConfig/utils/discoverSeries';
import {
  BASE_DYNAMIC_INTERVALS,
  BASE_INTERVALS,
  getEapTimePeriodsForInterval,
  MetricDetectorInterval,
} from 'sentry/views/detectors/datasetConfig/utils/timePeriods';
import {
  translateAggregateTag,
  translateAggregateTagBack,
} from 'sentry/views/detectors/datasetConfig/utils/translateAggregateTag';
import type {FieldValue} from 'sentry/views/discover/table/types';
import {FieldValueKind} from 'sentry/views/discover/table/types';

import type {DetectorDatasetConfig} from './base';

type SpansSeriesResponse = EventsStats;

const DEFAULT_EVENT_TYPES = [EventTypes.TRACE_ITEM_SPAN];

function getAggregateOptions(
  organization: Organization,
  tags?: TagCollection,
  customMeasurements?: CustomMeasurementCollection
): Record<string, SelectValue<FieldValue>> {
  const base = SpansConfig.getTableFieldOptions(organization, tags, customMeasurements);

  const apdexDefinition = getFieldDefinition(AggregationKey.APDEX, 'span');

  if (apdexDefinition?.parameters) {
    // Convert field definition parameters to discover field format
    const convertedParameters = apdexDefinition.parameters.map<AggregateParameter>(
      param => {
        if (param.kind === 'value') {
          return {
            kind: 'value' as const,
            dataType: param.dataType as 'number',
            required: param.required,
            defaultValue: param.defaultValue,
            placeholder: param.placeholder,
          };
        }
        return {
          kind: 'column' as const,
          columnTypes: Array.isArray(param.columnTypes)
            ? param.columnTypes
            : [param.columnTypes],
          required: param.required,
          defaultValue: param.defaultValue,
        };
      }
    );

    base['function:apdex'] = {
      label: 'apdex',
      value: {
        kind: FieldValueKind.FUNCTION,
        meta: {
          name: 'apdex',
          parameters: convertedParameters,
        },
      },
    };
  }

  return base;
}

export const DetectorSpansConfig: DetectorDatasetConfig<SpansSeriesResponse> = {
  name: t('Spans'),
  SearchBar: TraceSearchBar,
  defaultEventTypes: DEFAULT_EVENT_TYPES,
  defaultField: SpansConfig.defaultField,
  getAggregateOptions,
  getSeriesQueryOptions: options => {
    return getDiscoverSeriesQueryOptions({
      ...options,
      dataset: DetectorSpansConfig.getDiscoverDataset(),
      aggregate: translateAggregateTag(options.aggregate),
    });
  },
  getIntervals: ({detectionType}) => {
    const intervals =
      detectionType === 'dynamic' ? BASE_DYNAMIC_INTERVALS : BASE_INTERVALS;
    // EAP does not support minute intervals
    return intervals.filter(interval => interval > MetricDetectorInterval.ONE_MINUTE);
  },
  getTimePeriods: interval => getEapTimePeriodsForInterval(interval),
  separateEventTypesFromQuery: query => {
    const search = new MutableSearch(query);

    // Query has `is_transaction:true`, set eventTypes to transaction
    if (
      search.hasFilter('is_transaction') &&
      search
        .getFilterValues('is_transaction')
        .map(value => value.toLowerCase())
        .includes('true')
    ) {
      // Leave is_transaction:true in the query
      return {eventTypes: [EventTypes.TRANSACTION], query};
    }

    return {eventTypes: [EventTypes.TRACE_ITEM_SPAN], query};
  },
  toSnubaQueryString: snubaQuery => snubaQuery?.query ?? '',
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
  getDiscoverDataset: () => DiscoverDatasets.SPANS,
  formatAggregateForTitle: aggregate => {
    if (aggregate.startsWith('count(span.duration)')) {
      return t('Number of spans');
    }
    return aggregate;
  },
};
