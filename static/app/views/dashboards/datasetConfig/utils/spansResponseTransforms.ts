import type {
  EventsStats,
  GroupedMultiSeriesEventsStats,
  MultiSeriesEventsStats,
} from 'sentry/types/organization';
import type {EventsTableData, TableData} from 'sentry/utils/discover/discoverQuery';
import {type AggregationOutputType, type DataUnit} from 'sentry/utils/discover/fields';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {type DatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {transformEventsResponseToTable} from 'sentry/views/dashboards/datasetConfig/events';
import {type WidgetQuery} from 'sentry/views/dashboards/types';
import {
  isEventsStats,
  isEventsTimeSeriesResponse,
  isGroupedMultiSeriesEventsStats,
  isMultiSeriesEventsStats,
} from 'sentry/views/dashboards/utils/isEventsStats';
import {transformEventsResponseToSeries} from 'sentry/views/dashboards/utils/transformEventsResponseToSeries';
import {
  getTimeSeriesResultTypes,
  getTimeSeriesResultUnits,
  transformTimeSeriesResponseToSeries,
} from 'sentry/views/dashboards/utils/transformTimeSeriesResponseToSeries';
import {isPerformanceScoreBreakdownChart} from 'sentry/views/dashboards/widgetBuilder/utils/isPerformanceScoreBreakdownChart';
import {
  transformPerformanceScoreBreakdownSeries,
  transformPerformanceScoreBreakdownTimeSeries,
} from 'sentry/views/dashboards/widgetBuilder/utils/transformPerformanceScoreBreakdownSeries';

/**
 * Generic helper to extract metadata (units or types) from events-stats series data.
 * Handles both MultiSeriesEventsStats and GroupedMultiSeriesEventsStats responses.
 */
function extractSeriesMetadata<T>({
  data,
  getFieldMetaValue,
  getMetaField,
  widgetQuery,
}: {
  data: EventsStats | MultiSeriesEventsStats | GroupedMultiSeriesEventsStats;
  getFieldMetaValue: (meta: NonNullable<WidgetQuery['fieldMeta']>[number] | null) => T;
  getMetaField: (seriesMeta: EventsStats['meta'], aggregate: string) => T;
  widgetQuery: WidgetQuery;
}): Record<string, T> {
  const result: Record<string, T> = {};

  // Initialize from fieldMeta if available
  widgetQuery.fieldMeta?.forEach((meta, index) => {
    if (meta && widgetQuery.fields?.[index]) {
      result[widgetQuery.fields[index]] = getFieldMetaValue(meta);
    }
  });

  if (isEventsStats(data)) {
    // Plain EventsStats: single aggregate, no grouping. Meta is at the top level.
    if (data.meta) {
      widgetQuery.aggregates?.forEach(aggregate => {
        if (aggregate && !(aggregate in result)) {
          result[aggregate] = getMetaField(data.meta, aggregate);
        }
      });
    }
  } else if (isMultiSeriesEventsStats(data)) {
    // If there's only one aggregate and multiple groupings, series names are group names
    // In this case, we can use the first meta value for all series
    const firstMeta = widgetQuery.fieldMeta?.find(meta => meta !== null);
    const isSingleAggregateMultiGroup =
      firstMeta &&
      widgetQuery.aggregates?.length === 1 &&
      widgetQuery.columns?.length > 0;

    if (isSingleAggregateMultiGroup) {
      // Use hardcoded config for all series
      Object.keys(data).forEach(seriesName => {
        // Don't overwrite fieldMeta values
        if (!(seriesName in result)) {
          result[seriesName] = getFieldMetaValue(firstMeta);
        }
      });
    } else {
      Object.keys(data).forEach(seriesName => {
        const seriesData = data[seriesName];
        if (!seriesData?.meta) {
          return;
        }
        widgetQuery.aggregates?.forEach(aggregate => {
          // Multi-series can be keyed by aggregate or series name depending on aggregate count
          const key = widgetQuery.aggregates?.length > 1 ? aggregate : seriesName;
          // Don't overwrite fieldMeta values
          if (seriesData.meta && !(key in result)) {
            result[key] = getMetaField(seriesData.meta, aggregate);
          }
        });
      });
    }
  } else if (isGroupedMultiSeriesEventsStats(data)) {
    Object.keys(data).forEach(groupName => {
      widgetQuery.aggregates?.forEach(aggregate => {
        const seriesData = data[groupName]?.[aggregate] as EventsStats;
        // Don't overwrite fieldMeta values
        if (seriesData?.meta && aggregate && !(aggregate in result)) {
          result[aggregate] = getMetaField(seriesData.meta, aggregate);
        }
      });
    });
  }

  return result;
}

function transformSeries(
  data:
    | EventsStats
    | MultiSeriesEventsStats
    | GroupedMultiSeriesEventsStats
    | EventsTimeSeriesResponse,
  widgetQuery: WidgetQuery
) {
  if (isEventsTimeSeriesResponse(data)) {
    return transformTimeSeriesResponseToSeries(
      isPerformanceScoreBreakdownChart(widgetQuery)
        ? transformPerformanceScoreBreakdownTimeSeries(data)
        : data,
      widgetQuery
    );
  }

  let eventsStats = data;
  // Kind of a hack, but performance score breakdown charts need a special transformation to display correctly.
  if (
    isMultiSeriesEventsStats(eventsStats) &&
    isPerformanceScoreBreakdownChart(widgetQuery)
  ) {
    eventsStats = transformPerformanceScoreBreakdownSeries(eventsStats);
  }
  return transformEventsResponseToSeries(eventsStats, widgetQuery);
}

export const SpansResponseTransforms: Pick<
  DatasetConfig<
    | EventsStats
    | MultiSeriesEventsStats
    | GroupedMultiSeriesEventsStats
    | EventsTimeSeriesResponse,
    TableData | EventsTableData
  >,
  'transformTable' | 'transformSeries' | 'getSeriesResultUnit' | 'getSeriesResultType'
> = {
  transformTable: transformEventsResponseToTable,
  transformSeries,
  getSeriesResultUnit: (data, widgetQuery) => {
    if (isEventsTimeSeriesResponse(data)) {
      return getTimeSeriesResultUnits(data);
    }
    return extractSeriesMetadata({
      data,
      widgetQuery,
      getFieldMetaValue: meta => meta?.valueUnit as DataUnit,
      getMetaField: (seriesMeta, aggregate) => seriesMeta?.units?.[aggregate] as DataUnit,
    });
  },
  getSeriesResultType: (data, widgetQuery) => {
    if (isEventsTimeSeriesResponse(data)) {
      return getTimeSeriesResultTypes(data);
    }
    return extractSeriesMetadata({
      data,
      widgetQuery,
      getFieldMetaValue: meta => meta?.valueType as AggregationOutputType,
      getMetaField: (seriesMeta, aggregate) => seriesMeta?.fields?.[aggregate]!,
    });
  },
};
