import {getFormattedTimeRangeWithLeadingAndTrailingZero} from 'sentry/components/events/interfaces/spans/utils';

describe('test utility functions', () => {
  it('getFormattedTimeRangeWithLeadingAndTrailingZero', () => {
    let result = getFormattedTimeRangeWithLeadingAndTrailingZero(
      1658925888.601534,
      1658925888.60193
    );

    expect(result.start).toBe('1658925888.601534');
    expect(result.end).toBe('1658925888.601930');

    result = getFormattedTimeRangeWithLeadingAndTrailingZero(
      1658925888.601534,
      165892588.060193
    );
    expect(result.start).toBe('1658925888.601534');
    expect(result.end).toBe('0165892588.060193');

    result = getFormattedTimeRangeWithLeadingAndTrailingZero(
      16589258.6015,
      1658925888.060193
    );
    expect(result.start).toBe('0016589258.601500');
    expect(result.end).toBe('1658925888.060193');

    result = getFormattedTimeRangeWithLeadingAndTrailingZero(
      1658925888.601534,
      1658925888.601935
    );
    expect(result.start).toBe('1658925888.601534');
    expect(result.end).toBe('1658925888.601935');
  });
});
