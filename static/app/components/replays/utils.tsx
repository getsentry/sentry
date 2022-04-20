function padZero(num: number, len = 2): string {
  let str = String(num);
  const threshold = Math.pow(10, len - 1);
  if (num < threshold) {
    while (String(threshold).length > str.length) {
      str = '0' + num;
    }
  }
  return str;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// TODO: move into 'sentry/utils/formatters'
export function formatTime(ms: number): string {
  if (ms <= 0) {
    return '0:00';
  }
  const hour = Math.floor(ms / HOUR);
  ms = ms % HOUR;
  const minute = Math.floor(ms / MINUTE);
  ms = ms % MINUTE;
  const second = Math.floor(ms / SECOND);
  if (hour) {
    return `${hour}:${padZero(minute)}:${padZero(second)}`;
  }
  return `${minute}:${padZero(second)}`;
}

/**
 * Figure out how many ticks to show in an area.
 * If there is more space available, we can show more granular ticks, but if
 * less space is available, fewer ticks.
 * Similarly if the duration is short, the ticks will represent a short amount
 * of time (like every second) but if the duration is long one tick may
 * represent an hour.
 *
 * @param duration The amount of time that we need to chop up into even sections
 * @param width Total width available, pixels
 * @param minWidth Minimum space for each column, pixels. Ex: So we can show formatted time like `1:00:00` between major ticks
 * @returns
 */
export function countColumns(duration: number, width: number, minWidth: number = 50) {
  const maxCols = Math.ceil(width / minWidth);

  // List of all the possible time granularities to display
  // We could generate the list, which is basically a version of fizzbuzz, hard-coding is quicker.
  const timeOptions = [
    1 * HOUR,
    30 * MINUTE,
    20 * MINUTE,
    15 * MINUTE,
    10 * MINUTE,
    5 * MINUTE,
    2 * MINUTE,
    1 * MINUTE,
    30 * SECOND,
    10 * SECOND,
    5 * SECOND,
    1 * SECOND,
  ];

  const timeBasedCols = timeOptions.reduce<Map<number, number>>((map, time) => {
    map.set(time, Math.floor(duration / time));
    return map;
  }, new Map());

  const [timespan, cols] = Array.from(timeBasedCols.entries())
    .filter(([_span, c]) => c <= maxCols) // Filter for any valid timespan option where all ticks would fit
    .reduce((best, next) => (next[1] > best[1] ? next : best), [0, 0]); // select the timespan option with the most ticks

  const remaining = (duration - timespan * cols) / timespan;
  return {timespan, cols, remaining};
}
