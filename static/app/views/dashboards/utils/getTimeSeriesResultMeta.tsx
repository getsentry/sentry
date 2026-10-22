import type {AggregationOutputType, DataUnit} from 'sentry/utils/discover/fields';
import type {EventsTimeSeriesResponse} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

/**
 * Maps each y-axis in an `/events-timeseries/` response to its value type.
 *
 * Charts read type and unit from each series' own meta, so these maps are only
 * surfaced as `timeseriesResultsTypes`/`timeseriesResultsUnits` for the widget
 * builder, which uses the first entry to configure the threshold inputs.
 */
export function getTimeSeriesResultTypes(
  data: EventsTimeSeriesResponse
): Record<string, AggregationOutputType> {
  const result: Record<string, AggregationOutputType> = {};
  data.timeSeries.forEach(({yAxis, meta}) => {
    result[yAxis] = meta.valueType as AggregationOutputType;
  });
  return result;
}

/**
 * Maps each y-axis in an `/events-timeseries/` response to its value unit.
 * See `getTimeSeriesResultTypes` for how the result is used.
 */
export function getTimeSeriesResultUnits(
  data: EventsTimeSeriesResponse
): Record<string, DataUnit> {
  const result: Record<string, DataUnit> = {};
  data.timeSeries.forEach(({yAxis, meta}) => {
    result[yAxis] = meta.valueUnit as DataUnit;
  });
  return result;
}
