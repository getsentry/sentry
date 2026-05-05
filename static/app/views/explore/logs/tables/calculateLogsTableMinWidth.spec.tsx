import {calculateLogsTableMinWidth} from 'sentry/views/explore/logs/tables/calculateLogsTableMinWidth';

describe('calculateLogsTableMinWidth', () => {
  it.each([
    ['448px', 2],
    ['576px', 4],
    ['704px', 6],
    ['832px', 8],
  ])('returns length %d when given %d fields', (expected, fields) => {
    expect(calculateLogsTableMinWidth(fields)).toBe(expected);
  });
});
