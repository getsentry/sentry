import {formatChartDateTime} from './formatChartDateTime';

it('preserves the finite exceptional layouts with an explicit display timezone', () => {
  const date = '2026-01-01T13:02:03.004Z';
  const options = {timezone: 'UTC', clock: '12'} as const;
  expect(formatChartDateTime(date, 'ordinalDate', options)).toBe('Jan 1st');
  expect(formatChartDateTime(date, 'longOrdinalDate', options)).toBe('January 1st');
  expect(formatChartDateTime(date, 'ordinalDateWithYear', options)).toBe('Jan 1st 2026');
  expect(formatChartDateTime(date, 'year', options)).toBe('2026');
  expect(formatChartDateTime(date, 'timezone', options)).toBe('UTC');
  expect(formatChartDateTime(date, 'replayTime', options)).toBe('01:02:03.004');
  expect(formatChartDateTime(date, 'replayTime', {...options, clock: '24'})).toBe(
    '13:02:03.004'
  );
});

it.each([
  [1, '1st'],
  [2, '2nd'],
  [3, '3rd'],
  [11, '11th'],
  [12, '12th'],
  [13, '13th'],
  [21, '21st'],
  [22, '22nd'],
  [23, '23rd'],
  [31, '31st'],
])('preserves English ordinal day %s', (day, expected) => {
  expect(
    formatChartDateTime(Date.UTC(2026, 0, day), 'ordinalDate', {timezone: 'UTC'})
  ).toBe(`Jan ${expected}`);
});

it('uses explicit hour cycles at midnight and truncates fractional milliseconds', () => {
  expect(formatChartDateTime(12.75, 'replayTime', {timezone: 'UTC', clock: '24'})).toBe(
    '00:00:00.012'
  );
  expect(
    formatChartDateTime(new Date(12), 'replayTime', {timezone: 'UTC', clock: '12'})
  ).toBe('12:00:00.012');
});

it.each([
  ['2026-01-01T00:00:00Z', 'Australia/Sydney', 'AEDT'],
  ['2026-07-01T00:00:00Z', 'Australia/Sydney', 'AEST'],
  ['2026-01-01T00:00:00Z', 'Europe/London', 'GMT'],
  ['2026-07-01T00:00:00Z', 'Europe/London', 'BST'],
  ['2026-01-01T00:00:00Z', 'Europe/Paris', 'CET'],
  ['2026-07-01T00:00:00Z', 'Europe/Paris', 'CEST'],
  ['2026-01-01T00:00:00Z', 'Asia/Kathmandu', '+0545'],
  ['2026-01-01T00:00:00Z', '+05:45', 'GMT+5:45'],
])(
  'preserves the existing chart timezone label at %s in %s',
  (date, timezone, expected) => {
    expect(formatChartDateTime(date, 'timezone', {timezone})).toBe(expected);
  }
);

it('fails closed for invalid timestamps and non-instant input shapes', () => {
  for (const input of [
    '2026-01-01',
    '2026-01-01T00:00:00',
    Infinity,
    new Date(NaN),
    {},
    null,
  ]) {
    expect(
      Reflect.apply(formatChartDateTime, undefined, [input, 'year', {timezone: 'UTC'}])
    ).toBe('Invalid date');
  }
});

it.each([
  ['0000-01-01T00:00:00Z', '0000'],
  ['-000001-01-01T00:00:00Z', '-0001'],
  ['0099-01-01T00:00:00Z', '0099'],
])('preserves the signed ISO year of %s', (date, year) => {
  expect(formatChartDateTime(date, 'year', {timezone: 'UTC'})).toBe(year);
  expect(formatChartDateTime(date, 'ordinalDateWithYear', {timezone: 'UTC'})).toBe(
    `Jan 1st ${year}`
  );
});
