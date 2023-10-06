import {Duration, Unit} from 'sentry/utils/duration/types';
import {formatSecondsToClock} from 'sentry/utils/formatters';

type Format =
  // example: `3,600`
  | 'count-locale'
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
   * The timespan/duration to be displayed
   * ie: "1000 miliseconds" would have the same output as "1 second"
   *
   * If it's coming from javascript `new Date` then 'ms'
   * If it's from an SDK event, probably 'sec'
   */
  duration: Duration;
  /**
   * The precision of the output.
   *
   * If the output precision is more granular than the input precision you might
   * find the output value is rounded down, because least-significant digits are
   * simply chopped off.
   * Alternativly, because of IEEE 754, converting from a granular precision to
   * something less granular might, in some cases, change the least-significant
   * digits of the final value.
   */
  precision: Unit;
  /**
   * The output style to use
   *
   * ie: 120 seconds formatted as "h:mm" results in "2:00"
   * ie: 10500 formatted as "count" + "sec" results in "10.5"
   */
  style: Format;
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
  duration: [value, unit],
}: Args): string {
  const ms = normalizeTimespanToMs(value, unit);
  const valueInUnit = msToPrecision(ms, precision);

  switch (style) {
    case 'count-locale':
      return valueInUnit.toLocaleString();
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
