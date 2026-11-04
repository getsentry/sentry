import {createDurationFormatter, getDuration} from './index';

it('formats duration boundaries and explicit minimum units', () => {
  expect(getDuration(0.0001, {minimumUnit: 0.001})).toBe('100 microseconds');
  expect(getDuration(0.1, {precision: 2})).toBe('100.00 milliseconds');
  expect(getDuration(55, {minimumUnit: 60000})).toBe('1 minute');
  expect(getDuration(604800 * 4)).toBe('4 weeks');
  expect(getDuration(31536000)).toBe('1 year');
  expect(getDuration(-65, {absolute: true, style: 'short'})).toBe('1min');
  expect(getDuration(-65, {style: 'narrow'})).toBe('-1m');
});

it('injects translated labels, context and plural forms without application imports', () => {
  const formatDuration = createDurationFormatter({
    t: label => `translated:${label}`,
    pgettext: (context, label) => `${context}:${label}`,
    tn: (singular, plural, count) => (count === 1 ? `one:${singular}` : `many:${plural}`),
  });
  expect(formatDuration(1)).toBe('1 one:second');
  expect(formatDuration(2)).toBe('2 many:seconds');
  expect(formatDuration(2, {style: 'short'})).toBe('2translated:s');
  expect(formatDuration(60, {style: 'narrow'})).toBe('1abbreviated minutes:m');
});
