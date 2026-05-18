import {
  DURATION_UNIT_MULTIPLIERS,
  RATE_UNIT_MULTIPLIERS,
  SIZE_UNIT_MULTIPLIERS,
} from 'sentry/utils/discover/fields';

export function normalizeUnit(value: number, unit: string, dataType: string): number {
  const multiplier =
    dataType === 'rate'
      ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        RATE_UNIT_MULTIPLIERS[unit]
      : dataType === 'duration'
        ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          DURATION_UNIT_MULTIPLIERS[unit]
        : dataType === 'size'
          ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            SIZE_UNIT_MULTIPLIERS[unit]
          : 1;
  return value * multiplier;
}
