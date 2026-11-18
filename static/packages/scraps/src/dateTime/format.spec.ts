import {Temporal} from '@js-temporal/polyfill';
import moment from 'moment-timezone';

import {
  configureFormatting,
  type DateTimeInput,
  formatDateTime,
} from '@sentry/scraps/dateTime';

import {getSnapshot} from './config';
import {formatDateTimeWithSnapshot, formatTimezone} from './format';

const getTimezoneAbbreviation = (epochMilliseconds: number, timezone: string) =>
  moment.tz.zone(timezone)?.abbr(epochMilliseconds);

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2025-01-01T01:00:00Z'));
});

afterEach(() => {
  try {
    jest.runOnlyPendingTimers();
  } finally {
    jest.useRealTimers();
  }
});

it('formats dates, epoch milliseconds, and explicit-offset ISO timestamps alike', () => {
  const iso = '2024-12-31T20:00:00-05:00';
  const date = new Date(iso);
  const options = {timezone: 'UTC', year: 'always'} as const;
  expect(formatDateTime(iso, options)).toBe('Jan 1, 2025 1:00 AM UTC');
  expect(formatDateTime(date, options)).toBe(formatDateTime(iso, options));
  expect(formatDateTime(date.getTime(), options)).toBe(formatDateTime(iso, options));
});

it.each([
  [1.9, '12:00:00.001 AM UTC'],
  [-1.9, '11:59:59.999 PM UTC'],
])('truncates fractional epoch milliseconds %s like Date', (date, expected) => {
  expect(
    formatDateTime(date, {mode: 'time', precision: 'millisecond', timezone: 'UTC'})
  ).toBe(expected);
});

it.each([
  ['2025-01-01T00:00:00Z', 'Australia/Sydney', '11:00 AM AEDT'],
  ['2025-07-01T00:00:00Z', 'Australia/Sydney', '10:00 AM AEST'],
  ['2025-01-01T00:00:00Z', 'Australia/Adelaide', '10:30 AM ACDT'],
  ['2025-07-01T00:00:00Z', 'Australia/Adelaide', '9:30 AM ACST'],
  ['2025-01-01T00:00:00Z', 'Europe/London', '12:00 AM GMT'],
  ['2025-07-01T00:00:00Z', 'Europe/London', '1:00 AM BST'],
  ['2025-01-01T00:00:00Z', 'Europe/Paris', '1:00 AM CET'],
  ['2025-07-01T00:00:00Z', 'Europe/Paris', '2:00 AM CEST'],
  ['2025-01-01T00:00:00Z', 'Asia/Kathmandu', '5:45 AM +0545'],
  ['2025-01-01T00:00:00Z', 'Asia/Kolkata', '5:30 AM IST'],
  ['2025-01-01T00:00:00Z', 'UTC', '12:00 AM UTC'],
  ['2025-01-01T00:00:00Z', 'Etc/UTC', '12:00 AM UTC'],
  ['2025-01-01T00:00:00Z', 'Etc/GMT+5', '7:00 PM -05'],
  ['2025-01-01T00:00:00Z', '+05:45', '5:45 AM GMT+5:45'],
])('preserves the existing timezone label at %s in %s', (date, timezone, expected) => {
  const snapshot = {...getSnapshot(), getTimezoneAbbreviation};
  const restore = configureFormatting({
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
  });
  try {
    expect(
      formatDateTime(date, {
        mode: 'time',
        timezone,
        showTimezone: true,
      })
    ).toBe(expected);
  } finally {
    restore();
  }
});

it('uses the supplied snapshot label source and falls back to Intl when absent', () => {
  const date = '2025-01-01T00:00:00Z';
  const options = {
    mode: 'time',
    timezone: 'Australia/Sydney',
    showTimezone: true,
  } as const;
  const snapshot = {...getSnapshot(), getTimezoneAbbreviation: () => 'configured label'};
  expect(formatDateTimeWithSnapshot(date, options, snapshot)).toBe(
    '11:00 AM configured label'
  );
  expect(formatTimezone(Date.parse(date), options.timezone)).toBe('GMT+11');
  expect(
    formatTimezone(Date.parse(date), options.timezone, {
      ...snapshot,
      getTimezoneAbbreviation: () => {},
    })
  ).toBe('GMT+11');
});

it.each([
  ['0000-01-01T00:00:00Z', 'Jan 1, 0000 UTC'],
  ['-000001-01-01T00:00:00Z', 'Jan 1, -0001 UTC'],
  ['0001-01-01T00:00:00Z', 'Jan 1, 0001 UTC'],
])('preserves the signed ISO year for %s', (date, expected) => {
  expect(formatDateTime(date, {mode: 'date', year: 'always', timezone: 'UTC'})).toBe(
    expected
  );
});

it('decides the automatic year in the display timezone', () => {
  const date = '2024-12-31T23:30:00Z';
  expect(formatDateTime(date, {timezone: 'UTC'})).toBe('Dec 31, 2024 11:30 PM UTC');
  expect(formatDateTime(date, {timezone: 'America/Los_Angeles'})).toBe('Dec 31, 3:30 PM');
  expect(formatDateTime(date, {timezone: 'UTC', year: 'never'})).toBe(
    'Dec 31, 11:30 PM UTC'
  );
});

it('formats both sides of a daylight saving transition in the selected timezone', () => {
  const options = {
    timezone: 'America/New_York',
    mode: 'time',
    showTimezone: true,
  } as const;
  expect(formatDateTime('2025-03-09T06:59:00Z', options)).toBe('1:59 AM EST');
  expect(formatDateTime('2025-03-09T07:00:00Z', options)).toBe('3:00 AM EDT');
});

it.each([
  '2025-01-01',
  '2025-01-01T01:00:00',
  '2025-02-30T00:00:00Z',
  'not-a-date',
  new Date(Number.NaN),
  Number.NaN,
  Number.POSITIVE_INFINITY,
  Number.NEGATIVE_INFINITY,
  8.64e15 + 1,
] satisfies DateTimeInput[])(
  'returns a deterministic result for invalid input %s',
  date => {
    expect(formatDateTime(date)).toBe('Invalid date');
  }
);

it('rejects formatting-engine objects at the public boundary', () => {
  // @ts-expect-error Temporal objects are not accepted by the public input contract.
  expect(formatDateTime(Temporal.Instant.from('2025-01-01T01:00:00Z'))).toBe(
    'Invalid date'
  );
});

it('returns the same invalid result for unknown timezones', () => {
  expect(formatDateTime('2025-01-01T01:00:00Z', {timezone: 'Invalid/Timezone'})).toBe(
    'Invalid date'
  );
});

it.each([
  ['minute', '1:05 PM'],
  ['second', '1:05:06 PM'],
  ['millisecond', '1:05:06,123 PM'],
] as const)('keeps a French 12 hour clock at %s precision', (precision, expected) => {
  const snapshot = {
    timezone: 'Europe/Paris',
    getTimezoneAbbreviation,
    clock: '12' as const,
    locale: 'fr',
    messages: {
      t: (message: string) => message,
      tn: (singular: string, plural: string, count: number) =>
        Math.abs(count) === 1 ? singular : plural,
      pgettext: (_context: string, message: string) => message,
    },
  };
  const restore = configureFormatting({
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
  });
  try {
    expect(formatDateTime('2025-01-01T12:05:06.123Z', {mode: 'time', precision})).toBe(
      expected
    );
    expect(
      formatDateTime('2025-01-01T12:05:06.123Z', {
        mode: 'time',
        precision,
        showTimezone: true,
      })
    ).toBe(`${expected} CET`);
    expect(
      formatDateTime('2025-01-01T12:05:06.123Z', {mode: 'date', year: 'always'})
    ).toBe('1 janv. 2025');
  } finally {
    restore();
  }
});

it('uses localized zero padding for a 24 hour clock', () => {
  const snapshot = {
    timezone: 'UTC',
    clock: '24' as const,
    locale: 'fa',
    messages: {
      t: (message: string) => message,
      tn: (singular: string, plural: string, count: number) =>
        Math.abs(count) === 1 ? singular : plural,
      pgettext: (_context: string, message: string) => message,
    },
  };
  const restore = configureFormatting({
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
  });
  try {
    expect(
      formatDateTime('2025-01-01T05:06:00Z', {mode: 'time', showTimezone: false})
    ).toBe('۰۵:۰۶');
  } finally {
    restore();
  }
});

it.each([
  ['ja', '午後1:05'],
  ['zh-CN', '下午1:05'],
  ['zh-TW', '下午1:05'],
])('preserves date literals and day-period ordering for %s', (locale, expectedTime) => {
  const snapshot = {
    timezone: 'UTC',
    clock: '12' as const,
    locale,
    messages: {
      t: (message: string) => message,
      tn: (singular: string, plural: string, count: number) =>
        Math.abs(count) === 1 ? singular : plural,
      pgettext: (_context: string, message: string) => message,
    },
  };
  const restore = configureFormatting({
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
  });
  try {
    const date = '2025-01-01T13:05:06.123Z';
    expect(
      formatDateTime(date, {mode: 'date', year: 'always', showTimezone: false})
    ).toBe('2025年1月1日');
    expect(formatDateTime(date, {mode: 'date', year: 'never', showTimezone: false})).toBe(
      '1月1日'
    );
    expect(formatDateTime(date, {mode: 'time', showTimezone: false})).toBe(expectedTime);
  } finally {
    restore();
  }
});
