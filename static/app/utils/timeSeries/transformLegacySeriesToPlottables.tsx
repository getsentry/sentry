import type {Series} from 'sentry/types/echarts';
import type {EventsStats} from 'sentry/types/organization';
import {
  aggregateOutputType,
  RateUnit,
  type AggregationOutputType,
  type DataUnit,
} from 'sentry/utils/discover/fields';
import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import {convertEventsStatsToTimeSeriesData} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

/**
 * Transforms legacy Series[] data into Plottable[] objects for the TimeSeriesWidgetVisualization component.
 */
export function transformLegacySeriesToPlottables(
  timeseriesResults: Series[] | undefined,
  timeseriesResultsTypes: Record<string, AggregationOutputType> | undefined,
  timeseriesResultsUnits: Record<string, DataUnit> | undefined,
  widget: Widget
): Plottable[] {
  if (!timeseriesResults || timeseriesResults.length === 0) {
    return [];
  }

  const plottables = timeseriesResults
    .map(series => {
      const unaliasedSeriesName =
        series.seriesName?.split(' : ').at(-1)?.trim() ?? series.seriesName;
      const fieldType =
        timeseriesResultsTypes?.[unaliasedSeriesName] ??
        aggregateOutputType(unaliasedSeriesName);

      // Prefer results types and units from the config if available
      // Fallback to the default mapping logic if not available
      const mapped = mapAggregationTypeToValueTypeAndUnit(fieldType, unaliasedSeriesName);
      const valueType =
        timeseriesResultsTypes?.[series.seriesName] ??
        (mapped.valueType as AggregationOutputType);
      const valueUnit = timeseriesResultsUnits?.[series.seriesName] ?? mapped.valueUnit;

      const timeSeries = convertEventsStatsToTimeSeriesData(
        series.seriesName,
        createEventsStatsFromSeries(series, valueType, valueUnit)
      );
      return createPlottableFromTimeSeries(timeSeries[1], widget);
    })
    .filter(plottable => plottable !== null);
  return plottables;
}

function createEventsStatsFromSeries(
  series: Series,
  valueType: AggregationOutputType,
  valueUnit: string | null
): EventsStats {
  return {
    data: series.data.map(dataUnit => [
      typeof dataUnit.name === 'number'
        ? dataUnit.name / 1000
        : new Date(dataUnit.name).getTime() / 1000,
      [{count: dataUnit.value, comparisonCount: undefined}],
    ]),
    meta: {
      fields: {
        [series.seriesName]: valueType,
      },
      units: {
        [series.seriesName]: valueUnit,
      },
      isMetricsData: false,
      tips: {columns: undefined, query: undefined},
    },
  };
}

function createPlottableFromTimeSeries(
  timeSeries: TimeSeries,
  widget: Widget
): Plottable | null {
  const shouldStack = widget.queries[0]?.columns.length! > 0;

  const {displayType, title} = widget;
  switch (displayType) {
    case DisplayType.LINE:
      return new Line(timeSeries);
    case DisplayType.AREA:
      return new Area(timeSeries);
    case DisplayType.BAR:
      return new Bars(timeSeries, {stack: shouldStack ? title : undefined});
    default:
      return null;
  }
}

export function mapAggregationTypeToValueTypeAndUnit(
  aggregationType: AggregationOutputType,
  fieldName: string
): {
  valueType: TimeSeries['meta']['valueType'];
  valueUnit: TimeSeries['meta']['valueUnit'];
} {
  // Special case, epm/eps come back as numbers but we want to show as reate
  // Checking eps/epm here is a hack until we migrate to new /timeseries endpoint
  if (fieldName?.includes('eps()')) {
    return {valueType: 'rate', valueUnit: RateUnit.PER_SECOND};
  }
  if (fieldName?.includes('epm()')) {
    return {valueType: 'rate', valueUnit: RateUnit.PER_MINUTE};
  }

  switch (aggregationType) {
    case 'rate':
      return {valueType: 'rate', valueUnit: null};
    case 'size':
      return {valueType: 'size', valueUnit: null};
    case 'duration':
      return {valueType: 'duration', valueUnit: null};
    case 'score':
      return {valueType: 'score', valueUnit: null};
    case 'percentage':
      return {valueType: 'percentage', valueUnit: null};
    case 'integer':
    case 'number':
    default:
      return {valueType: 'number', valueUnit: null};
  }
}
