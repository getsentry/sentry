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
  bit: 1 / 8,
  bits: 1 / 8,
  byte: 1,
  bytes: 1,
  kibibyte: 1024,
  kibibytes: 1024,
  kilobyte: 1000,
  kilobytes: 1000,
  mebibyte: 1024 ** 2,
  mebibytes: 1024 ** 2,
  megabyte: 1000 ** 2,
  megabytes: 1000 ** 2,
  gibibyte: 1024 ** 3,
  gibibytes: 1024 ** 3,
  gigabyte: 1000 ** 3,
  gigabytes: 1000 ** 3,
  tebibyte: 1024 ** 4,
  tebibytes: 1024 ** 4,
  terabyte: 1000 ** 4,
  terabytes: 1000 ** 4,
  pebibyte: 1024 ** 5,
  pebibytes: 1024 ** 5,
  petabyte: 1000 ** 5,
  petabytes: 1000 ** 5,
  exabyte: 1000 ** 6,
  exabytes: 1000 ** 6,
  exbibyte: 1024 ** 6,
  exbibytes: 1024 ** 6,
};

export function getMetricsConversionFunction(fromUnit: string, toUnit: string) {
  let conversionFactors: Record<string, number> | null = null;

  if (fromUnit in timeConversionFactors && toUnit in timeConversionFactors) {
    conversionFactors = timeConversionFactors;
  } else if (fromUnit in byte10ConversionFactors && toUnit in byte10ConversionFactors) {
    conversionFactors = byte10ConversionFactors;
  }

  return <T extends number | null>(value: T): T => {
    if (!value || !conversionFactors) {
      return value;
    }

    return (value * (conversionFactors[fromUnit] / conversionFactors[toUnit])) as T;
  };
}
