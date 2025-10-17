import type {Series} from 'sentry/types/echarts';
import {
  aggregateOutputType,
  DurationUnit,
  SizeUnit,
  type AggregationOutputType,
} from 'sentry/utils/discover/fields';
import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';

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

  return timeseriesResults
    .map(series => {
      const timeSeries = transformLegacySeriesToTimeSeries(
        series,
        timeseriesResultsTypes
      );
      return createPlottableFromTimeSeries(timeSeries, widget.displayType);
    })
    .filter(plottable => plottable !== null);
}

function transformLegacySeriesToTimeSeries(
  series: Series,
  timeseriesResultsTypes: Record<string, AggregationOutputType> | undefined
): TimeSeries {
  const seriesName = series.seriesName;
  const fieldType =
    timeseriesResultsTypes?.[seriesName] ?? aggregateOutputType(seriesName);
  const {valueType, valueUnit} = mapAggregationTypeToValueTypeAndUnit(fieldType);

  let interval = 0;
  if (series.data.length >= 2) {
    const firstTimestamp =
      typeof series.data[0]!.name === 'number' ? series.data[0]!.name : 0;
    const secondTimestamp =
      typeof series.data[1]!.name === 'number' ? series.data[1]!.name : 0;
    if (firstTimestamp !== 0 && secondTimestamp !== 0) {
      interval = secondTimestamp - firstTimestamp;
    }
  }

  return {
    yAxis: seriesName,
    meta: {
      interval,
      valueType,
      valueUnit,
    },
    values: series.data.map(dataPoint => ({
      timestamp: new Date(dataPoint.name).getTime(),
      value: dataPoint.value,
      confidence: series.confidence,
    })),
  };
}

function createPlottableFromTimeSeries(
  timeSeries: TimeSeries,
  displayType: DisplayType
): Plottable | null {
  switch (displayType) {
    case DisplayType.LINE:
      return new Line(timeSeries);
    case DisplayType.AREA:
      return new Area(timeSeries);
    case DisplayType.BAR:
      return new Bars(timeSeries);
    default:
      return null;
  }
}

function mapAggregationTypeToValueTypeAndUnit(aggregationType: AggregationOutputType): {
  valueType: TimeSeries['meta']['valueType'];
  valueUnit: TimeSeries['meta']['valueUnit'];
} {
  switch (aggregationType) {
    case 'duration':
      return {valueType: 'duration', valueUnit: DurationUnit.MILLISECOND};

    case 'size':
      return {valueType: 'size', valueUnit: SizeUnit.BYTE};

    case 'percentage':
      return {valueType: 'percentage', valueUnit: 'percentage'};

    case 'date':
      return {valueType: 'duration', valueUnit: DurationUnit.MILLISECOND};

    case 'integer':
    case 'number':
    default:
      return {valueType: 'number', valueUnit: null};
  }
}
