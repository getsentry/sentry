import {
  DURATION_UNIT_LABELS,
  DURATION_UNIT_MULTIPLIERS,
  DurationUnit,
} from 'sentry/utils/discover/fields';

/**
 * Format the duration value for a chart Y axis. Automatically chooses the appropriate unit, and formats for the current locale.
 *
 * @param milliseconds The duration in milliseconds
 */
export function formatYAxisDuration(milliseconds: number): string {
  const unit = getScaleUnitForDuration(milliseconds);

  return `${(milliseconds / DURATION_UNIT_MULTIPLIERS[unit]).toLocaleString()}${DURATION_UNIT_LABELS[unit]}`;
}

function getScaleUnitForDuration(milliseconds: number) {
  const absoluteMilliseconds = Math.abs(milliseconds);
  let unit: DurationUnit;

  if (absoluteMilliseconds >= DURATION_UNIT_MULTIPLIERS[DurationUnit.YEAR]) {
    unit = DurationUnit.YEAR;
  } else if (absoluteMilliseconds >= DURATION_UNIT_MULTIPLIERS[DurationUnit.MONTH]) {
    unit = DurationUnit.MONTH;
  } else if (absoluteMilliseconds >= DURATION_UNIT_MULTIPLIERS[DurationUnit.WEEK]) {
    unit = DurationUnit.WEEK;
  } else if (absoluteMilliseconds >= DURATION_UNIT_MULTIPLIERS[DurationUnit.DAY]) {
    unit = DurationUnit.DAY;
  } else if (absoluteMilliseconds >= DURATION_UNIT_MULTIPLIERS[DurationUnit.HOUR]) {
    unit = DurationUnit.HOUR;
  } else if (absoluteMilliseconds >= DURATION_UNIT_MULTIPLIERS[DurationUnit.MINUTE]) {
    unit = DurationUnit.MINUTE;
  } else if (absoluteMilliseconds >= DURATION_UNIT_MULTIPLIERS[DurationUnit.SECOND]) {
    unit = DurationUnit.SECOND;
  } else if (
    absoluteMilliseconds >= DURATION_UNIT_MULTIPLIERS[DurationUnit.MILLISECOND]
  ) {
    unit = DurationUnit.MILLISECOND;
  } else if (
    absoluteMilliseconds >= DURATION_UNIT_MULTIPLIERS[DurationUnit.MICROSECOND]
  ) {
    unit = DurationUnit.MICROSECOND;
  } else {
    unit = DurationUnit.NANOSECOND;
  }

  return unit;
}
