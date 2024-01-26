import {t} from 'sentry/locale';
import type {MetricType} from 'sentry/types/metrics';
import {defined, formatBytesBase2, formatBytesBase10} from 'sentry/utils';
import {
  DAY,
  formatNumberWithDynamicDecimalPoints,
  HOUR,
  MINUTE,
  MONTH,
  SECOND,
  WEEK,
} from 'sentry/utils/formatters';

const metricTypeToReadable: Record<MetricType, string> = {
  c: t('counter'),
  g: t('gauge'),
  d: t('distribution'),
  s: t('set'),
  e: t('derived'),
};

// Converts from "c" to "counter"
export function getReadableMetricType(type?: string) {
  return metricTypeToReadable[type as MetricType] ?? t('unknown');
}

const MILLISECOND = 1;
const MICROSECOND = MILLISECOND / 1000;

function formatDuration(seconds: number): string {
  if (!seconds) {
    return '0ms';
  }
  const absValue = Math.abs(seconds * 1000);
  // value in milliseconds
  const msValue = seconds * 1000;

  let unit: FormattingSupportedMetricUnit | 'month' = 'nanosecond';
  let value = msValue * 1000000;

  if (absValue >= MONTH) {
    unit = 'month';
    value = msValue / MONTH;
  } else if (absValue >= WEEK) {
    unit = 'week';
    value = msValue / WEEK;
  } else if (absValue >= DAY) {
    unit = 'day';
    value = msValue / DAY;
  } else if (absValue >= HOUR) {
    unit = 'hour';
    value = msValue / HOUR;
  } else if (absValue >= MINUTE) {
    unit = 'minute';
    value = msValue / MINUTE;
  } else if (absValue >= SECOND) {
    unit = 'second';
    value = msValue / SECOND;
  } else if (absValue >= MILLISECOND) {
    unit = 'millisecond';
    value = msValue;
  } else if (absValue >= MICROSECOND) {
    unit = 'microsecond';
    value = msValue * 1000;
  }

  return `${formatNumberWithDynamicDecimalPoints(value)}${
    unit === 'month' ? 'mo' : METRIC_UNIT_TO_SHORT[unit]
  }`;
}

// The metric units that we have support for in the UI
// others will still be displayed, but will not have any effect on formatting
export const formattingSupportedMetricUnits = [
  'none',
  'nanosecond',
  'microsecond',
  'millisecond',
  'second',
  'minute',
  'hour',
  'day',
  'week',
  'ratio',
  'percent',
  'bit',
  'byte',
  'kibibyte',
  'kilobyte',
  'mebibyte',
  'megabyte',
  'gibibyte',
  'gigabyte',
  'tebibyte',
  'terabyte',
  'pebibyte',
  'petabyte',
  'exbibyte',
  'exabyte',
] as const;

type FormattingSupportedMetricUnit = (typeof formattingSupportedMetricUnits)[number];

const METRIC_UNIT_TO_SHORT: Record<FormattingSupportedMetricUnit, string> = {
  nanosecond: 'ns',
  microsecond: 'μs',
  millisecond: 'ms',
  second: 's',
  minute: 'min',
  hour: 'hr',
  day: 'day',
  week: 'wk',
  ratio: '%',
  percent: '%',
  bit: 'b',
  byte: 'B',
  kibibyte: 'KiB',
  kilobyte: 'KB',
  mebibyte: 'MiB',
  megabyte: 'MB',
  gibibyte: 'GiB',
  gigabyte: 'GB',
  tebibyte: 'TiB',
  terabyte: 'TB',
  pebibyte: 'PiB',
  petabyte: 'PB',
  exbibyte: 'EiB',
  exabyte: 'EB',
  none: '',
};

export function formatMetricUsingUnit(value: number | null, unit: string) {
  if (!defined(value)) {
    return '\u2014';
  }

  switch (unit as FormattingSupportedMetricUnit) {
    case 'nanosecond':
      return formatDuration(value / 1000000000);
    case 'microsecond':
      return formatDuration(value / 1000000);
    case 'millisecond':
      return formatDuration(value / 1000);
    case 'second':
      return formatDuration(value);
    case 'minute':
      return formatDuration(value * 60);
    case 'hour':
      return formatDuration(value * 60 * 60);
    case 'day':
      return formatDuration(value * 60 * 60 * 24);
    case 'week':
      return formatDuration(value * 60 * 60 * 24 * 7);
    case 'ratio':
      return `${formatNumberWithDynamicDecimalPoints(value * 100)}%`;
    case 'percent':
      return `${formatNumberWithDynamicDecimalPoints(value)}%`;
    case 'bit':
      return formatBytesBase2(value / 8);
    case 'byte':
      return formatBytesBase10(value);
    case 'kibibyte':
      return formatBytesBase2(value * 1024);
    case 'kilobyte':
      return formatBytesBase10(value, 1);
    case 'mebibyte':
      return formatBytesBase2(value * 1024 ** 2);
    case 'megabyte':
      return formatBytesBase10(value, 2);
    case 'gibibyte':
      return formatBytesBase2(value * 1024 ** 3);
    case 'gigabyte':
      return formatBytesBase10(value, 3);
    case 'tebibyte':
      return formatBytesBase2(value * 1024 ** 4);
    case 'terabyte':
      return formatBytesBase10(value, 4);
    case 'pebibyte':
      return formatBytesBase2(value * 1024 ** 5);
    case 'petabyte':
      return formatBytesBase10(value, 5);
    case 'exbibyte':
      return formatBytesBase2(value * 1024 ** 6);
    case 'exabyte':
      return formatBytesBase10(value, 6);
    case 'none':
    default:
      return value.toLocaleString();
  }
}

const getShortMetricUnit = (unit: string): string => METRIC_UNIT_TO_SHORT[unit] ?? '';

export function formatMetricUsingFixedUnit(
  value: number | null,
  unit: string,
  op?: string
) {
  if (value === null) {
    return '\u2014';
  }

  const formattedNumber = formatNumberWithDynamicDecimalPoints(value);

  return op === 'count'
    ? formattedNumber
    : `${formattedNumber}${getShortMetricUnit(unit)}`.trim();
}

export function formatMetricsUsingUnitAndOp(
  value: number | null,
  unit: string,
  operation?: string
) {
  if (operation === 'count') {
    // if the operation is count, we want to ignore the unit and always format the value as a number
    return value?.toLocaleString() ?? '';
  }
  return formatMetricUsingUnit(value, unit);
}
