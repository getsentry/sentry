import formatReplayDuration from 'sentry/utils/duration/formatReplayDuration';

describe('formatReplayDuration', () => {
  it.each([
    ['seconds', 15 * 1000, '00:15'],
    ['minutes', 2.5 * 60 * 1000, '02:30'],
    ['hours', 75 * 60 * 1000, '01:15:00'],
  ])('should format a %s long duration into a string', (_desc, duration, expected) => {
    expect(formatReplayDuration(duration)).toEqual(expected);
  });
});
