import type {Series} from 'sentry/types/echarts';
import type {EventsStats} from 'sentry/types/organization';
import {
  aggregateOutputType,
  RateUnit,
  type AggregationOutputType,
  type DataUnit,
} from 'sentry/utils/discover/fields';
import {parseGroupBy} from 'sentry/utils/timeSeries/parseGroupBy';
import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {Bars} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/bars';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import {convertEventsStatsToTimeSeriesData} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

/**
 * Delimiter used by the backend to separate parts of a series name.
 * Format: "alias : yAxis : groupValue1,groupValue2"
 */
export const SERIES_NAME_PART_DELIMITER = ' : ';

export function transformLegacySeriesToTimeSeries(
  timeseriesResult: Series | undefined,
  timeseriesResultsTypes: Record<string, AggregationOutputType> | undefined,
  timeseriesResultsUnits: Record<string, DataUnit> | undefined,
  fields: string[] = [],
  yAxis = '',
  alias?: string
): TimeSeries | null {
  if (!timeseriesResult) {
    return null;
  }

  const fieldType = timeseriesResultsTypes?.[yAxis] ?? aggregateOutputType(yAxis);

  // Prefer results types and units from the config if available
  // Fallback to the default mapping logic if not available
  const mapped = mapAggregationTypeToValueTypeAndUnit(fieldType, yAxis);
  const seriesName = timeseriesResult.seriesName ?? yAxis;
  const valueType =
    timeseriesResultsTypes?.[seriesName] ?? (mapped.valueType as AggregationOutputType);
  const valueUnit = timeseriesResultsUnits?.[seriesName] ?? mapped.valueUnit;

  const splitSeriesName = seriesName.split(SERIES_NAME_PART_DELIMITER);

  const isOther = splitSeriesName.includes('Other');

  // Extract group values by filtering out alias and yAxis from the series name
  // Series name format: "alias : groupValue1,groupValue2 : yAxis" or "groupValue1,groupValue2" or "groupValue1,groupValue2 : yAxis"
  const groupValuesPart = splitSeriesName.find(name => name !== alias && name !== yAxis);

  const groupBy =
    fields.length > 0 && groupValuesPart ? parseGroupBy(groupValuesPart, fields) : null;

  const timeSeries = convertEventsStatsToTimeSeriesData(
    yAxis,
    createEventsStatsFromSeries(
      {...timeseriesResult, seriesName: yAxis},
      valueType,
      valueUnit
    )
  )[1];

  return {
    ...timeSeries,
    groupBy,
    meta: {
      ...timeSeries.meta,
      isOther,
    },
  };
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

export function createPlottableFromTimeSeries(
  timeSeries: TimeSeries,
  widget: Widget,
  alias?: string,
  name?: string
): Plottable | null {
  const shouldStack = widget.queries[0]?.columns.length! > 0;

  const {displayType, title} = widget;
  switch (displayType) {
    case DisplayType.LINE:
      return new Line(timeSeries, {alias, name});
    case DisplayType.AREA:
      return new Area(timeSeries, {alias, name});
    case DisplayType.BAR:
      return new Bars(timeSeries, {stack: shouldStack ? title : undefined, alias, name});
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
