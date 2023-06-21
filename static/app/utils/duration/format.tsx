import {formatSecondsToClock} from 'sentry/utils/formatters';

type Unit = 'ms' | 'sec';
type Format =
  | 'count-locale'
  | 'count'
  | 'h:mm:ss.sss'
  | 'h:mm:ss'
  | 'hh:mm:ss.sss'
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

/**
 * Format a timespan (aka duration) into a formatted string.
 *
 * A timespan is expressed a `number` and a `unit` pair -> [value, unit]
 */
export default function format({
  precision,
  style,
  timespan: [value, unit],
}: Args): string {
  // console.log({format, precision});
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
  const factor = {
    ms: 1,
    sec: 1000,
  }[unit];
  return value * factor;
}

function msToPrecision(value: number, unit: Unit): number {
  if (value === 0) {
    return 0;
  }
  const factor = {
    ms: 1,
    sec: 1000,
  }[unit];
  return value / factor;
}
