import {Unit} from 'sentry/utils/duration/types';

export default function durationUnitToSuffix(unit: Unit) {
  return {
    ms: 'ms',
    sec: 's',
    min: 'm',
    hour: 'h',
    day: 'd',
    week: 'w',
  }[unit];
}
