import {
  DurationUnit,
  FractionUnit,
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
  percentage: FractionUnit.RATIO,
  string: null,
  size: SizeUnit.BYTE,
  rate: RateUnit.PER_SECOND,
  score: null,
} satisfies Record<AggregationOutputType, DataUnit>;
