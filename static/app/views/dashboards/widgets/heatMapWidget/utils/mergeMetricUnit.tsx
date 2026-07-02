import type {DataUnit} from 'sentry/utils/discover/fields';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
import {mapMetricUnitToFieldType} from 'sentry/views/explore/metrics/utils';

/**
 * The heatmap API returns the Y axis using the generic `value` field, so the
 * response meta carries no metric unit. Patch the Y axis with the selected
 * metric's unit/type so the chart formats values correctly (e.g. durations,
 * sizes) instead of rendering raw numbers.
 *
 * Ideally the backend would return the metric's unit in the response meta and
 * this client-side patch wouldn't be needed.
 */
export function mergeMetricUnit(
  series: HeatMapSeries,
  metricUnit: string | undefined
): HeatMapSeries {
  const {fieldType, unit} = mapMetricUnitToFieldType(metricUnit);
  if (!unit) {
    return series;
  }
  return {
    ...series,
    meta: {
      ...series.meta,
      yAxis: {
        ...series.meta.yAxis,
        valueType: fieldType,
        valueUnit: unit as DataUnit,
      },
    },
  };
}
