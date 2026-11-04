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
