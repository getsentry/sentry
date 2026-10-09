// TODO: Remove this, use `SIZE_UNIT_MULTIPLIERS` instead
export const SIZE_UNITS = {
  bit: 1 / 8,
  byte: 1,
  kibibyte: 1024,
  mebibyte: 1024 ** 2,
  gibibyte: 1024 ** 3,
  tebibyte: 1024 ** 4,
  pebibyte: 1024 ** 5,
  exbibyte: 1024 ** 6,
  kilobyte: 1000,
  megabyte: 1000 ** 2,
  gigabyte: 1000 ** 3,
  terabyte: 1000 ** 4,
  petabyte: 1000 ** 5,
  exabyte: 1000 ** 6,
};

// TODO: Remove this, use `DURATION_UNIT_MULTIPLIERS` instead
export const DURATION_UNITS = {
  nanosecond: 1 / 1000 ** 2,
  microsecond: 1 / 1000,
  millisecond: 1,
  second: 1000,
  minute: 1000 * 60,
  hour: 1000 * 60 * 60,
  day: 1000 * 60 * 60 * 24,
  week: 1000 * 60 * 60 * 24 * 7,
};
