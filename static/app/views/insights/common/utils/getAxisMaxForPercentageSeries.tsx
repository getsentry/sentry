import type {Series} from 'sentry/types/echarts';

/**
 * Given a set of `Series` objects that contain percentage data (i.e., every item in `data` has a `value` between 0 and 1) return an appropriate max value.
 *
 * e.g., for series with very low values (like 5xx rates), it rounds to the nearest significant digit. For other cases, it limits it to 100
 */
export function getAxisMaxForPercentageSeries(series: Series[]): number {
  const maxValue = Math.max(
    ...series.map(serie => Math.max(...serie.data.map(datum => datum.value)))
  );

  const maxNumberOfDecimalPlaces = Math.ceil(Math.min(0, Math.log10(maxValue)));

  return Math.pow(10, maxNumberOfDecimalPlaces);
}
