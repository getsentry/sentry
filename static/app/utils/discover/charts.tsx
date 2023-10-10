import {captureMessage} from '@sentry/react';
import * as Sentry from '@sentry/react';
import {LegendComponentOption} from 'echarts';

import {t} from 'sentry/locale';
import {Series} from 'sentry/types/echarts';
import {defined, formatBytesBase2} from 'sentry/utils';
import {AggregationOutputType, RateUnits} from 'sentry/utils/discover/fields';
import {
  DAY,
  formatAbbreviatedNumber,
  formatPercentage,
  formatRate,
  getDuration,
  HOUR,
  MINUTE,
  SECOND,
  WEEK,
} from 'sentry/utils/formatters';

/**
 * Formatter for chart tooltips that handle a variety of discover and metrics result values.
 * If the result is metric values, the value can be of type number or null
 */
export function tooltipFormatter(
  value: number | null,
  outputType: AggregationOutputType = 'number'
): string {
  if (!defined(value)) {
    return '\u2014';
  }
  return tooltipFormatterUsingAggregateOutputType(value, outputType);
}

/**
 * Formatter for chart tooltips that takes the aggregate output type directly
 */
export function tooltipFormatterUsingAggregateOutputType(
  value: number | null,
  type: string
): string {
  if (!defined(value)) {
    return '\u2014';
  }
  switch (type) {
    case 'integer':
    case 'number':
      return value.toLocaleString();
    case 'percentage':
      return formatPercentage(value, 2);
    case 'duration':
      return getDuration(value / 1000, 2, true);
    case 'size':
      return formatBytesBase2(value);
    default:
      return value.toString();
  }
}

/**
 * Formatter for chart axis labels that handle a variety of discover result values
 * This function is *very similar* to tooltipFormatter but outputs data with less precision.
 */
export function axisLabelFormatter(
  value: number,
  outputType: AggregationOutputType,
  abbreviation: boolean = false,
  durationUnit?: number,
  rateUnit?: RateUnits
): string {
  return axisLabelFormatterUsingAggregateOutputType(
    value,
    outputType,
    abbreviation,
    durationUnit,
    rateUnit
  );
}

/**
 * Formatter for chart axis labels that takes the aggregate output type directly
 */
export function axisLabelFormatterUsingAggregateOutputType(
  value: number,
  type: string,
  abbreviation: boolean = false,
  durationUnit?: number,
  rateUnit?: RateUnits
): string {
  switch (type) {
    case 'integer':
    case 'number':
      return abbreviation ? formatAbbreviatedNumber(value) : value.toLocaleString();
    case 'percentage':
      return formatPercentage(value, 0);
    case 'duration':
      return axisDuration(value, durationUnit);
    case 'size':
      return formatBytesBase2(value, 0);
    case 'rate':
      return formatRate(value, rateUnit);
    default:
      return value.toString();
  }
}

/**
 * Specialized duration formatting for axis labels.
 * In that context we are ok sacrificing accuracy for more
 * consistent sizing.
 *
 * @param value Number of milliseconds to format.
 */
export function axisDuration(value: number, durationUnit?: number): string {
  durationUnit ??= categorizeDuration(value);
  if (value === 0) {
    return '0';
  }
  switch (durationUnit) {
    case WEEK: {
      const label = (value / WEEK).toFixed(0);
      return t('%swk', label);
    }
    case DAY: {
      const label = (value / DAY).toFixed(0);
      return t('%sd', label);
    }
    case HOUR: {
      const label = (value / HOUR).toFixed(0);
      return t('%shr', label);
    }
    case MINUTE: {
      const label = (value / MINUTE).toFixed(0);
      return t('%smin', label);
    }
    case SECOND: {
      const label = (value / SECOND).toFixed(0);
      return t('%ss', label);
    }
    default:
      const label = value.toFixed(0);
      return t('%sms', label);
  }
}

/**
 * Given an array of series and an eCharts legend object,
 * finds the range of y values (min and max) based on which series is selected in the legend.
 * Does not assume any ordering of series, will check min/max for all series in multiseries.
 * @param series Array of eCharts series
 * @param legend eCharts legend object
 * @returns
 */
export function findRangeOfMultiSeries(series: Series[], legend?: LegendComponentOption) {
  const range: {max: number; min: number} = {
    max: 0,
    min: Infinity,
  };

  if (!series[0]?.data) {
    return undefined;
  }

  for (const {seriesName, data} of series) {
    if (legend?.selected?.[seriesName] !== false) {
      const max = Math.max(...data.map(({value}) => value).filter(Number.isFinite));
      const min = Math.min(...data.map(({value}) => value).filter(Number.isFinite));

      if (max > range.max) {
        range.max = max;
      }
      if (min < range.min) {
        range.min = min;
      }
      if (min < 0) {
        Sentry.withScope(scope => {
          scope.setTag('seriesName', seriesName);
          scope.setExtra('min', min);
          scope.setExtra('max', min);
          captureMessage('Found negative min value in multiseries');
        });
      }
    }
  }
  if (range.max === 0 && range.min === Infinity) {
    return undefined;
  }
  return range;
}

/**
 * Given a eCharts series and legend, returns the unit to be used on the yAxis for a duration chart
 * @param series eCharts series array
 * @param legend eCharts legend object
 * @returns
 */
export function getDurationUnit(
  series: Series[],
  legend?: LegendComponentOption
): number {
  let durationUnit = 0;
  const range = findRangeOfMultiSeries(series, legend);
  if (range) {
    const avg = (range.max + range.min) / 2;
    durationUnit = categorizeDuration((range.max - range.min) / 5); // avg of 5 yAxis ticks per chart

    const numOfDigits = (avg / durationUnit).toFixed(0).length;
    if (numOfDigits > 6) {
      durationUnit = categorizeDuration(avg);
    }
  }
  return durationUnit;
}

/**
 * Categorizes the duration by Second, Minute, Hour, etc
 * Ex) categorizeDuration(1200) = MINUTE
 * @param value Duration in ms
 */
export function categorizeDuration(value): number {
  if (value >= WEEK) {
    return WEEK;
  }
  if (value >= DAY) {
    return DAY;
  }
  if (value >= HOUR) {
    return HOUR;
  }
  if (value >= MINUTE) {
    return MINUTE;
  }
  if (value >= SECOND) {
    return SECOND;
  }
  return 1;
}
