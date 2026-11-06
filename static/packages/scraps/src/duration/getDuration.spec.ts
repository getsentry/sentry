import {configureFormatting} from '@sentry/scraps/dateTime';

import {getDuration} from './index';

it('injects translated labels, context and plural forms without application imports', () => {
  const snapshot = {
    timezone: 'UTC',
    clock: '12' as const,
    locale: 'en',
    messages: {
      t: (label: string) => `translated:${label}`,
      pgettext: (context: string, label: string) => `${context}:${label}`,
      tn: (singular: string, plural: string, count: number) =>
        count === 1 ? `one:${singular}` : `many:${plural}`,
    },
  };
  const restore = configureFormatting({
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
  });
  try {
    expect(getDuration(1)).toBe('1 one:second');
    expect(getDuration(2)).toBe('2 many:seconds');
    expect(getDuration(2, {style: 'short'})).toBe('2translated:s');
    expect(getDuration(60, {style: 'narrow'})).toBe('1abbreviated minutes:m');
  } finally {
    restore();
  }
});

describe('getDuration()', () => {
  it('should format durations', () => {
    expect(getDuration(0.0001, {minimumUnit: 'microsecond'})).toBe('100 microseconds');
    expect(getDuration(0.1)).toBe('100 milliseconds');
    expect(getDuration(0.1, {precision: 2})).toBe('100.00 milliseconds');
    expect(getDuration(1)).toBe('1 second');
    expect(getDuration(2)).toBe('2 seconds');
    expect(getDuration(65)).toBe('1 minute');
    expect(getDuration(122)).toBe('2 minutes');
    expect(getDuration(55, {minimumUnit: 'minute'})).toBe('1 minute');
    expect(getDuration(3720)).toBe('1 hour');
    expect(getDuration(36000)).toBe('10 hours');
    expect(getDuration(86400)).toBe('1 day');
    expect(getDuration(86400 * 2)).toBe('2 days');
    expect(getDuration(604800)).toBe('1 week');
    expect(getDuration(604800, {precision: 2, minimumUnit: 'month'})).toBe('0.23 months');
    expect(getDuration(604800 * 4)).toBe('4 weeks');
    expect(getDuration(2629800)).toBe('1 month');
    expect(getDuration(604800 * 12)).toBe('3 months');
    expect(getDuration(2629800 * 12)).toBe('1 year');
    expect(getDuration(2629800 * 25)).toBe('2 years');
    expect(getDuration(2629800 * 61)).toBe('5 years');
  });

  it('should format negative durations', () => {
    expect(getDuration(-0.0001, {minimumUnit: 'microsecond'})).toBe('-100 microseconds');
    expect(getDuration(-0.1)).toBe('-100 milliseconds');
    expect(getDuration(-0.1, {precision: 2})).toBe('-100.00 milliseconds');
    expect(getDuration(-1)).toBe('-1 second');
    expect(getDuration(-2)).toBe('-2 seconds');
    expect(getDuration(-65)).toBe('-1 minute');
    expect(getDuration(-122)).toBe('-2 minutes');
    expect(getDuration(-3720)).toBe('-1 hour');
    expect(getDuration(-36000)).toBe('-10 hours');
    expect(getDuration(-86400)).toBe('-1 day');
    expect(getDuration(-86400 * 2)).toBe('-2 days');
    expect(getDuration(-604800)).toBe('-1 week');
    expect(getDuration(-604800, {precision: 2, minimumUnit: 'month'})).toBe(
      '-0.23 months'
    );
    expect(getDuration(-604800 * 4)).toBe('-4 weeks');
    expect(getDuration(-2629800)).toBe('-1 month');
    expect(getDuration(-604800 * 12)).toBe('-3 months');
    expect(getDuration(-2629800 * 12)).toBe('-1 year');
    expect(getDuration(-2629800 * 25)).toBe('-2 years');
    expect(getDuration(-2629800 * 61)).toBe('-5 years');
  });

  it('should format numbers and abbreviate units', () => {
    expect(
      getDuration(0, {precision: 2, style: 'short', minimumUnit: 'microsecond'})
    ).toBe('0.00μs');
    expect(getDuration(0, {precision: 2, style: 'short'})).toBe('0.00ms');
    expect(getDuration(0, {style: 'short'})).toBe('0ms');
    expect(getDuration(0.1, {style: 'short'})).toBe('100ms');
    expect(getDuration(0.1, {precision: 2, style: 'short'})).toBe('100.00ms');
    expect(getDuration(1, {precision: 2, style: 'short'})).toBe('1.00s');
    expect(getDuration(122, {style: 'short'})).toBe('2min');
    expect(getDuration(3600, {style: 'short'})).toBe('1hr');
    expect(getDuration(86400, {style: 'short'})).toBe('1d');
    expect(getDuration(86400 * 2, {style: 'short'})).toBe('2d');
    expect(getDuration(604800, {style: 'short'})).toBe('1wk');
    expect(getDuration(604800 * 2, {style: 'short'})).toBe('2wk');
    expect(getDuration(2629800, {style: 'short'})).toBe('1mo');
    expect(getDuration(604800 * 12, {style: 'short'})).toBe('3mo');
    expect(getDuration(2629800 * 12, {style: 'short'})).toBe('1yr');
    expect(getDuration(2629800 * 25, {style: 'short'})).toBe('2yr');
    expect(getDuration(2629800 * 61, {style: 'short'})).toBe('5yr');
  });

  it('should format numbers and abbreviate units with one letter', () => {
    expect(
      getDuration(0, {precision: 2, style: 'narrow', minimumUnit: 'microsecond'})
    ).toBe('0.00μs');
    expect(getDuration(0, {precision: 2, style: 'narrow'})).toBe('0.00ms');
    expect(getDuration(0, {style: 'narrow'})).toBe('0ms');
    expect(getDuration(0.1, {style: 'narrow'})).toBe('100ms');
    expect(getDuration(0.1, {precision: 2, style: 'narrow'})).toBe('100.00ms');
    expect(getDuration(1, {precision: 2, style: 'narrow'})).toBe('1.00s');
    expect(getDuration(122, {style: 'narrow'})).toBe('2m');
    expect(getDuration(3600, {style: 'narrow'})).toBe('1h');
    expect(getDuration(86400, {style: 'narrow'})).toBe('1d');
    expect(getDuration(86400 * 2, {style: 'narrow'})).toBe('2d');
    expect(getDuration(604800, {style: 'narrow'})).toBe('1w');
    expect(getDuration(604800 * 2, {style: 'narrow'})).toBe('2w');
    expect(getDuration(2629800, {style: 'narrow'})).toBe('1m');
    expect(getDuration(604800 * 12, {style: 'narrow'})).toBe('3m');
    expect(getDuration(2629800 * 12, {style: 'narrow'})).toBe('1y');
    expect(getDuration(2629800 * 25, {style: 'narrow'})).toBe('2y');
    expect(getDuration(2629800 * 61, {style: 'narrow'})).toBe('5y');
  });

  it('should format negative durations with absolute', () => {
    expect(getDuration(-0.1, {absolute: true})).toBe('100 milliseconds');
    expect(getDuration(-0.1, {precision: 2, absolute: true})).toBe('100.00 milliseconds');
    expect(getDuration(-1, {absolute: true})).toBe('1 second');
    expect(getDuration(-2, {absolute: true})).toBe('2 seconds');
    expect(getDuration(-65, {absolute: true})).toBe('1 minute');
    expect(getDuration(-122, {absolute: true})).toBe('2 minutes');
    expect(getDuration(-3720, {absolute: true})).toBe('1 hour');
    expect(getDuration(-36000, {absolute: true})).toBe('10 hours');
    expect(getDuration(-86400, {absolute: true})).toBe('1 day');
    expect(getDuration(-86400 * 2, {absolute: true})).toBe('2 days');
    expect(getDuration(-604800, {absolute: true})).toBe('1 week');
    expect(getDuration(-604800 * 4, {absolute: true})).toBe('4 weeks');
    expect(getDuration(-2629800, {absolute: true})).toBe('1 month');
    expect(getDuration(-604800 * 12, {absolute: true})).toBe('3 months');
    expect(getDuration(-2629800 * 12, {absolute: true})).toBe('1 year');
    expect(getDuration(-2629800 * 25, {absolute: true})).toBe('2 years');
    expect(getDuration(-2629800 * 61, {absolute: true})).toBe('5 years');
  });
});
