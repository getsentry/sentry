/**
 * Convert an interval string into a number of seconds.
 * This allows us to create end timestamps from starting ones
 * enabling us to find events in narrow windows.
 *
 * @param {String} interval The interval to convert.
 * @return {Integer}
 */

export function intervalToMilliseconds(interval: string): number {
  const pattern = /^(\d+)(w|d|h|m)$/;
  const matches = pattern.exec(interval);
  if (!matches) {
    return 0;
  }
  const [, value, unit] = matches;
  const multipliers = {
    w: 60 * 60 * 24 * 7,
    d: 60 * 60 * 24,
    h: 60 * 60,
    m: 60,
  };
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return parseInt(value!, 10) * multipliers[unit!] * 1000;
}
