import type {Series} from 'sentry/types/echarts';
import type {EventsStats} from 'sentry/types/organization';
import {
  aggregateOutputType,
  RateUnit,
  type AggregationOutputType,
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
  widget: Widget
): Plottable[] {
  if (!timeseriesResults || timeseriesResults.length === 0) {
    return [];
  }

  const plottables = timeseriesResults
    .map(series => {
      const unaliasedSeriesName =
        series.seriesName?.split(' : ')[1]?.trim() ?? series.seriesName;
      const fieldType =
        timeseriesResultsTypes?.[unaliasedSeriesName] ??
        aggregateOutputType(unaliasedSeriesName);
      const {valueType, valueUnit} = mapAggregationTypeToValueTypeAndUnit(
        fieldType,
        unaliasedSeriesName
      );
      const timeSeries = convertEventsStatsToTimeSeriesData(
        series.seriesName,
        createEventsStatsFromSeries(series, valueType as AggregationOutputType, valueUnit)
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

function mapAggregationTypeToValueTypeAndUnit(
  aggregationType: AggregationOutputType,
  fieldName: string
): {
  valueType: TimeSeries['meta']['valueType'];
  valueUnit: TimeSeries['meta']['valueUnit'];
} {
  // Checking eps/epm here is a hack until we migrate to new /timeseries endpoint
  if (fieldName.includes('eps()')) {
    return {valueType: 'rate', valueUnit: RateUnit.PER_SECOND};
  }
  if (fieldName.includes('epm()')) {
    return {valueType: 'rate', valueUnit: RateUnit.PER_MINUTE};
  }

  switch (aggregationType) {
    // special case, epm/eps return back number, but we want to show them as rate
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
