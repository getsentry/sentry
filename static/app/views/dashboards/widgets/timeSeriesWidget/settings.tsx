import {
  DurationUnit,
  RateUnit,
  SizeUnit,
  type AggregationOutputType,
  type DataUnit,
} from 'sentry/utils/discover/fields';

export const Y_AXIS_INTEGER_TOLERANCE = 0.000001;
export const FALLBACK_TYPE = 'number';
export const FALLBACK_UNIT_FOR_FIELD_TYPE = {
  number: null,
  integer: null,
  date: null,
  duration: DurationUnit.MILLISECOND,
  percentage: null,
  string: null,
  size: SizeUnit.BYTE,
  size_base10: SizeUnit.BYTE,
  rate: RateUnit.PER_SECOND,
  score: null,
} satisfies Record<AggregationOutputType, DataUnit>;
