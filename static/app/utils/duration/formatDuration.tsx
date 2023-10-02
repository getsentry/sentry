import {formatSecondsToClock} from 'sentry/utils/formatters';

type Unit = 'ms' | 'sec' | 'min' | 'hour' | 'day' | 'week';
type Format =
  // example: `3,600`
  | 'count-locale'
  // example: `24h`
  | 'count-unit'
  // example: `86400`
  | 'count'
  // example: `1:00:00.000`
  | 'h:mm:ss.sss'
  // example: `1:00:00`
  | 'h:mm:ss'
  // example: `01:00:00.000
  | 'hh:mm:ss.sss'
  // example: `01:00:00`
  | 'hh:mm:ss';

type Args = {
  /**
   *
   * TODO: Support
   */
  precision: Unit;
  /**
   * The output style to use
   *
   * ie: 120 seconds formatted as "h:mm" results in "2:00"
   * ie: 10500 formatted as "count" + "sec" results in "10.5"
   */
  style: Format;
  /**
   * The timespan/duration to be displayed
   * ie: "1000 miliseconds" would have the same output as "1 second"
   *
   * If it's coming from javascript `new Date` then 'ms'
   * If it's from an SDK event, probably 'sec'
   *
   * TODO: support more units
   */
  timespan: [number, Unit];
};

const UNIT_TO_SUFFIX = {
  ms: 'ms',
  sec: 's',
  min: 'm',
  hour: 'h',
  day: 'd',
  week: 'w',
};

const PRECISION_FACTORS: Record<Unit, number> = {
  ms: 1,
  sec: 1000,
  min: 1000 * 60,
  hour: 1000 * 60 * 60,
  day: 1000 * 60 * 60 * 24,
  week: 1000 * 60 * 60 * 24 * 7,
};

/**
 * Format a timespan (aka duration) into a formatted string.
 *
 * A timespan is expressed a `number` and a `unit` pair -> [value, unit]
 */
export default function formatDuration({
  precision,
  style,
  timespan: [value, unit],
}: Args): string {
  const ms = normalizeTimespanToMs(value, unit);
  const valueInUnit = msToPrecision(ms, precision);

  switch (style) {
    case 'count-locale':
      return valueInUnit.toLocaleString();
    case 'count-unit':
      return `${valueInUnit}${UNIT_TO_SUFFIX[unit]}`;
    case 'count':
      return String(valueInUnit);
    case 'h:mm:ss': // fall-through
    case 'hh:mm:ss': // fall-through
    case 'h:mm:ss.sss': // fall-through
    case 'hh:mm:ss.sss':
      const includeMs = style.endsWith('.sss');
      const valueInSec = msToPrecision(ms, 'sec');
      const str = formatSecondsToClock(valueInSec, {
        padAll: style.startsWith('hh:mm:ss'),
      });
      const [head, tail] = str.split('.');
      return includeMs ? [head, tail ?? '000'].join('.') : String(head);
    default:
      throw new Error('Invalid style');
  }
}

function normalizeTimespanToMs(value: number, unit: Unit): number {
  const factor = PRECISION_FACTORS[unit];
  return value * factor;
}

function msToPrecision(value: number, unit: Unit): number {
  if (value === 0) {
    return 0;
  }
  const factor = PRECISION_FACTORS[unit];
  return value / factor;
}
