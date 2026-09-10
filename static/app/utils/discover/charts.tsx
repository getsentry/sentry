import * as Sentry from '@sentry/react';

import type {Series} from 'sentry/types/echarts';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {defined} from 'sentry/utils/defined';
import type {
  AggregationOutputType,
  DataUnit,
  RateUnit,
} from 'sentry/utils/discover/fields';
import {
  ABYTE_UNITS,
  DURATION_UNIT_MULTIPLIERS,
  SizeUnit,
} from 'sentry/utils/discover/fields';
import {axisDuration} from 'sentry/utils/duration/axisDuration';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {formatAbbreviatedNumber, formatRate} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {convertSize} from 'sentry/utils/unitConversion/convertSize';
import {
  isADurationUnit,
  isASizeUnit,
} from 'sentry/views/dashboards/widgets/common/typePredicates';

import {categorizeDuration} from './categorizeDuration';

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
  type: string,
  unit?: DataUnit
): string {
  if (!defined(value)) {
    return '\u2014';
  }
  switch (type) {
    case 'integer':
    case 'number':
      return value.toLocaleString();
    case 'percentage':
      return formatPercentage(value);
    case 'duration': {
      const durationUnitString = unit ?? undefined;
      const durationMultiplier = isADurationUnit(durationUnitString)
        ? DURATION_UNIT_MULTIPLIERS[durationUnitString]
        : 1; // default to milliseconds
      const valueInMs = value * durationMultiplier;
      return getDuration(valueInMs / 1000, 2, true);
    }
    case 'size': {
      const unitString = unit ?? undefined;
      const resolvedUnit = isASizeUnit(unitString) ? unitString : SizeUnit.BYTE;
      const sizeInBytes = convertSize(value, resolvedUnit, SizeUnit.BYTE);
      const formatter =
        unitString && ABYTE_UNITS.includes(unitString)
          ? formatBytesBase10
          : formatBytesBase2;
      return formatter(sizeInBytes);
    }
    case 'rate':
      if (unit) {
        return formatRate(value, unit as RateUnit);
      }
      return formatRate(value);
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
  abbreviation = false,
  durationUnit?: number
): string {
  return axisLabelFormatterUsingAggregateOutputType(
    value,
    outputType,
    abbreviation,
    durationUnit
  );
}

/**
 * Formatter for chart axis labels that takes the aggregate output type directly
 */
export function axisLabelFormatterUsingAggregateOutputType(
  value: number,
  type: string,
  abbreviation = false,
  durationUnit?: number,
  rateUnit?: RateUnit,
  decimalPlaces = 0,
  sizeUnit?: DataUnit
): string {
  switch (type) {
    case 'integer':
    case 'number':
      return abbreviation ? formatAbbreviatedNumber(value) : value.toLocaleString();
    case 'percentage':
      return formatPercentage(value, decimalPlaces);
    case 'duration': {
      const durationDataUnit = sizeUnit ?? undefined;
      const durationMult = isADurationUnit(durationDataUnit)
        ? DURATION_UNIT_MULTIPLIERS[durationDataUnit]
        : 1; // default to milliseconds
      const valueInMs = value * durationMult;
      return axisDuration(valueInMs, durationUnit);
    }
    case 'size': {
      const unitString = sizeUnit ?? undefined;
      const resolvedUnit = isASizeUnit(unitString) ? unitString : SizeUnit.BYTE;
      const sizeInBytes = convertSize(value, resolvedUnit, SizeUnit.BYTE);
      const formatter =
        unitString && ABYTE_UNITS.includes(unitString)
          ? formatBytesBase10
          : formatBytesBase2;
      return formatter(sizeInBytes, 0);
    }
    case 'rate':
      return formatRate(value, rateUnit);
    default:
      return value.toString();
  }
}

/**
 * Given an array of series, finds the range of y values (min and max).
 * Does not assume any ordering of series, will check min/max for all series in multiseries.
 * @param series Array of eCharts series
 * @returns
 */
export function findRangeOfMultiSeries(series: Series[]) {
  const range: {max: number; min: number} = {
    max: 0,
    min: Infinity,
  };

  if (!series[0]?.data) {
    return;
  }

  for (const {seriesName, data} of series) {
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
        Sentry.captureMessage('Found negative min value in multiseries');
      });
    }
  }
  if (range.max === 0 && range.min === Infinity) {
    return;
  }
  return range;
}

/**
 * Given an eCharts series, returns the unit to be used on the yAxis for a duration chart
 * @param series eCharts series array
 */
export function getDurationUnit(series: Series[]): number {
  let durationUnit = 0;
  const range = findRangeOfMultiSeries(series);
  if (range) {
    const min = range.min;
    const max = range.max;
    const avg = (max + min) / 2;
    durationUnit = categorizeDuration((max - min) / 5); // avg of 5 yAxis ticks per chart

    const numOfDigits = (avg / durationUnit).toFixed(0).length;
    if (numOfDigits > 6) {
      durationUnit = categorizeDuration(avg);
    }
  }
  return durationUnit;
}
