import {formatSecondsToClock} from 'sentry/utils/duration/formatSecondsToClock';
import type {Duration, Unit} from 'sentry/utils/duration/types';

export type Format =
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
  | 'hh:mm:ss'
  // example: `PT4H18M3S`
  // See https://en.wikipedia.org/wiki/ISO_8601#Durations
  // See https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#durations
  | 'ISO8601';

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
    case 'hh:mm:ss.sss': {
      const truncatedValueInMs = normalizeTimespanToMs(
        Math.floor(valueInUnit),
        precision
      );
      const valueInSec = msToPrecision(truncatedValueInMs, 'sec');

      const padAll = style.startsWith('hh:mm:ss');
      const includeMs = style.endsWith('.sss');
      const str = formatSecondsToClock(valueInSec, {padAll});
      const [head, tail] = str.split('.');
      return includeMs
        ? [head, precision === 'ms' ? tail ?? '000' : '000'].join('.')
        : String(head);
    }
    case 'ISO8601': {
      const output = ['P'];

      let incr = 0;
      const weeks = Math.floor(msToPrecision(ms - incr, 'week'));
      output.push(weeks ? weeks + 'W' : '');
      if (precision !== 'week') {
        incr += weeks * PRECISION_FACTORS.week;
        const days = Math.floor(msToPrecision(ms - incr, 'day'));
        output.push(days ? days + 'D' : '');

        if (precision !== 'day') {
          incr += days * PRECISION_FACTORS.day;
          const hours = Math.floor(msToPrecision(ms - incr, 'hour'));
          output.push(hours ? hours + 'H' : '');

          if (precision !== 'hour') {
            output.push('T');
            incr += hours * PRECISION_FACTORS.hour;
            const minutes = Math.floor(msToPrecision(ms - incr, 'min'));
            output.push(minutes ? minutes + 'M' : '');

            if (precision !== 'min') {
              incr += minutes * PRECISION_FACTORS.min;
              const seconds = Math.floor(msToPrecision(ms - incr, 'sec'));

              if (precision !== 'sec') {
                incr += seconds * PRECISION_FACTORS.sec;
                const milliseconds = Math.floor(msToPrecision(ms - incr, 'ms'));
                output.push(seconds || milliseconds ? String(seconds) : '');
                output.push(
                  milliseconds ? '.' + milliseconds.toString().padStart(3, '0') : ''
                );
                output.push(seconds || milliseconds ? 'S' : '');
              } else {
                output.push(seconds ? String(seconds) + 'S' : '');
              }
            }
          }
        }
      }

      return output.join('');
    }
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
