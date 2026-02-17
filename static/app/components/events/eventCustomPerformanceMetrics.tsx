import {
  DURATION_UNITS,
  PERCENTAGE_UNITS,
  SIZE_UNITS,
} from 'sentry/utils/discover/fieldRenderers';

export function isNotMarkMeasurement(field: string) {
  return !field.startsWith('mark.');
}

export function isNotPerformanceScoreMeasurement(field: string) {
  return !field.startsWith('score.');
}

export function getFieldTypeFromUnit(unit: any) {
  if (unit) {
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    if (DURATION_UNITS[unit]) {
      return 'duration';
    }
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    if (SIZE_UNITS[unit]) {
      return 'size';
    }
    if (PERCENTAGE_UNITS.includes(unit)) {
      return 'percentage';
    }
    if (unit === 'none') {
      return 'integer';
    }
    return 'string';
  }
  return 'number';
}
