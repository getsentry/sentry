import type {SelectValue} from '@sentry/scraps/select';

import {isTokenFunction} from 'sentry/components/arithmeticBuilder/token';
import {tokenizeExpression} from 'sentry/components/arithmeticBuilder/tokenizer';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import type {EventsStats, Organization} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import {
  isEquation,
  stripEquationPrefix,
  type AggregateParameter,
  type ColumnType,
} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {AggregationKey, FieldValueType, getFieldDefinition} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import type {FieldValue} from 'sentry/views/discover/table/types';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {getFunctionLabel} from 'sentry/views/explore/utils/getFunctionLabel';

import {TraceSearchBar} from './components/traceSearchBar';
import {
  getDiscoverSeriesQueryOptions,
  transformEventsStatsComparisonSeries,
  transformEventsStatsToSeries,
} from './utils/discoverSeries';
import {
  BASE_DYNAMIC_INTERVALS,
  BASE_INTERVALS,
  getEapTimePeriodsForInterval,
  MetricDetectorInterval,
} from './utils/timePeriods';
import {
  translateAggregateTag,
  translateAggregateTagBack,
} from './utils/translateAggregateTag';
import type {AggregateSummary, DetectorDatasetConfig} from './base';

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
        const {columnTypes} = param;
        return {
          kind: 'column' as const,
          columnTypes: Array.isArray(columnTypes)
            ? (columnTypes as ColumnType[])
            : ({name, dataType}) =>
                columnTypes({key: name, valueType: dataType as FieldValueType}),
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

/**
 * Summarizes an equation as reference labels (A, B, …), plus a row per unique aggregate.
 */
function summarizeEquation(aggregate: string): AggregateSummary | null {
  if (!isEquation(aggregate)) {
    return null;
  }

  const tokens = tokenizeExpression(stripEquationPrefix(aggregate));
  const labelByAggregate = new Map<string, string>();
  for (const token of tokens) {
    if (isTokenFunction(token) && !labelByAggregate.has(token.text)) {
      labelByAggregate.set(token.text, getFunctionLabel(labelByAggregate.size));
    }
  }
  if (labelByAggregate.size === 0) {
    return null;
  }

  const expression = tokens
    .map(token => labelByAggregate.get(token.text) ?? token.text)
    .filter(text => text.length > 0)
    .join(' ')
    // Tokens are space joined, so parentheses arrive as "( A + B )".
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')');

  return {
    expression,
    headers: [t('Aggregate')],
    components: Array.from(labelByAggregate, ([text, label]) => ({
      label,
      values: [text],
    })),
  };
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
    if (isEquation(aggregate)) {
      return stripEquationPrefix(aggregate);
    }
    if (aggregate.startsWith('count(span.duration)')) {
      return t('Number of spans');
    }
    return aggregate;
  },
  getAggregateSummary: summarizeEquation,
  // Always load and display stored equations. Creating or editing them is gated in
  // the form by the `spans-monitor-equations` flag.
  supportsEquations: true,
};
