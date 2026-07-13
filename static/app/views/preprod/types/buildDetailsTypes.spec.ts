import {getBuildNumber} from 'sentry/views/preprod/types/buildDetailsTypes';

describe('getBuildNumber', () => {
  it('prefers build_number_raw when present', () => {
    expect(
      getBuildNumber({build_number: '1000002000003', build_number_raw: '1.2.3'})
    ).toBe('1.2.3');
  });

  it('falls back to build_number when build_number_raw is null', () => {
    expect(getBuildNumber({build_number: '456', build_number_raw: null})).toBe('456');
  });

  it('falls back to build_number when build_number_raw is an empty string', () => {
    expect(getBuildNumber({build_number: '456', build_number_raw: ''})).toBe('456');
  });

  it('returns undefined when neither is set', () => {
    expect(getBuildNumber({})).toBeUndefined();
  });

  it('returns undefined when appInfo is null or undefined', () => {
    expect(getBuildNumber(null)).toBeUndefined();
    expect(getBuildNumber(undefined)).toBeUndefined();
  });
});
