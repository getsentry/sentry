import {isLogsUnsupportedBySDK} from 'sentry/views/explore/replays/detail/ourlogs/unsupportedReplays';

describe('isLogsUnsupportedBySDK', function () {
  it('is unsupported without an sdk name', function () {
    expect(isLogsUnsupportedBySDK(null, '1.0.0')).toBe(true);
    expect(isLogsUnsupportedBySDK(undefined, '1.0.0')).toBe(true);
    expect(isLogsUnsupportedBySDK('', '1.0.0')).toBe(true);
  });

  it('is supported for sdks without a known cutoff', function () {
    expect(isLogsUnsupportedBySDK('sentry.javascript.browser', '1.0.0')).toBe(false);
    expect(isLogsUnsupportedBySDK('sentry.python', null)).toBe(false);
  });

  it('sentry.cocoa is supported since 9.0.0', function () {
    expect(isLogsUnsupportedBySDK('sentry.cocoa', '9.0.0')).toBe(false);
    expect(isLogsUnsupportedBySDK('sentry.cocoa', '9.24.0')).toBe(false);
    expect(isLogsUnsupportedBySDK('sentry.cocoa', '10.0.0')).toBe(false);
  });

  it('sentry.cocoa is unsupported before 9.0.0', function () {
    expect(isLogsUnsupportedBySDK('sentry.cocoa', '8.57.2')).toBe(true);
    expect(isLogsUnsupportedBySDK('sentry.cocoa', '9.0.0-alpha.0')).toBe(true);
  });

  it('sentry.cocoa without a version is unsupported', function () {
    expect(isLogsUnsupportedBySDK('sentry.cocoa', null)).toBe(true);
    expect(isLogsUnsupportedBySDK('sentry.cocoa', undefined)).toBe(true);
    expect(isLogsUnsupportedBySDK('sentry.cocoa', '')).toBe(true);
  });
});
