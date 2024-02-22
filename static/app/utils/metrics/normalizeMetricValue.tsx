import {
  DAY,
  HOUR,
  MICROSECOND,
  MILLISECOND,
  MINUTE,
  NANOSECOND,
  SECOND,
  WEEK,
} from 'sentry/utils/formatters';

const timeConversionFactors = {
  week: WEEK,
  weeks: WEEK,
  day: DAY,
  days: DAY,
  hour: HOUR,
  hours: HOUR,
  minute: MINUTE,
  minutes: MINUTE,
  second: SECOND,
  seconds: SECOND,
  millisecond: MILLISECOND,
  milliseconds: MILLISECOND,
  microsecond: MICROSECOND,
  microseconds: MICROSECOND,
  nanosecond: NANOSECOND,
  nanoseconds: NANOSECOND,
};

const byte10ConversionFactors = {
  byte: 1,
  bytes: 1,
  kilobyte: 1000,
  kilobytes: 1000,
  megabyte: 1000 ** 2,
  megabytes: 1000 ** 2,
  gigabyte: 1000 ** 3,
  gigabytes: 1000 ** 3,
  terabyte: 1000 ** 4,
  terabytes: 1000 ** 4,
  petabyte: 1000 ** 5,
  petabytes: 1000 ** 5,
  exabyte: 1000 ** 6,
  exabytes: 1000 ** 6,
};

const byte2ConversionFactors = {
  bit: 1 / 8,
  bits: 1 / 8,
  byte2: 1,
  kibibyte: 1024,
  kibibytes: 1024,
  mebibyte: 1024 ** 2,
  mebibytes: 1024 ** 2,
  gibibyte: 1024 ** 3,
  gibibytes: 1024 ** 3,
  tebibyte: 1024 ** 4,
  tebibytes: 1024 ** 4,
  pebibyte: 1024 ** 5,
  pebibytes: 1024 ** 5,
  exbibyte: 1024 ** 6,
  exbibytes: 1024 ** 6,
};

export function getMetricConversionFunction(fromUnit: string, toUnit: string) {
  let conversionFactors: Record<string, number> | null = null;

  if (fromUnit in timeConversionFactors && toUnit in timeConversionFactors) {
    conversionFactors = timeConversionFactors;
  } else if (fromUnit in byte10ConversionFactors && toUnit in byte10ConversionFactors) {
    conversionFactors = byte10ConversionFactors;
  } else if (fromUnit in byte2ConversionFactors && toUnit in byte2ConversionFactors) {
    conversionFactors = byte2ConversionFactors;
  }

  return <T extends number | null>(value: T): T => {
    if (!value || !conversionFactors) {
      return value;
    }

    return (value * (conversionFactors[fromUnit] / conversionFactors[toUnit])) as T;
  };
}

export function getNormalizedMetricUnit(unit: string, operation?: string) {
  if (!unit || operation === 'count' || operation === 'count_unique') {
    return 'none';
  }

  if (unit in timeConversionFactors) {
    return 'millisecond';
  }

  if (unit in byte10ConversionFactors) {
    return 'byte';
  }

  if (unit in byte2ConversionFactors) {
    return 'byte2';
  }

  return unit;
}

export function getMetricValueNormalizer(unit: string, operation?: string) {
  const normalizedMetricUnit = getNormalizedMetricUnit(unit, operation);
  return getMetricConversionFunction(unit, normalizedMetricUnit);
}
