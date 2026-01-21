import {
  DurationUnit,
  RateUnit,
  SizeUnit,
  type AggregationOutputType,
  type DataUnit,
} from 'sentry/utils/discover/fields';

/**
 * Tolerance for determining if a Y-axis value should be formatted as an integer.
 */
export const Y_AXIS_INTEGER_TOLERANCE = 0.000001;

/**
 * Fallback data type when the actual type cannot be determined.
 */
export const FALLBACK_TYPE = 'number';

/**
 * Default units for each field type when no specific unit is provided.
 */
export const FALLBACK_UNIT_FOR_FIELD_TYPE = {
  number: null,
  integer: null,
  date: null,
  duration: DurationUnit.MILLISECOND,
  percentage: null,
  string: null,
  size: SizeUnit.BYTE,
  rate: RateUnit.PER_SECOND,
  score: null,
} satisfies Record<AggregationOutputType, DataUnit>;
