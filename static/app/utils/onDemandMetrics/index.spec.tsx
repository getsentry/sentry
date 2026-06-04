import {STANDARD_SEARCH_FIELD_KEYS} from 'sentry/utils/onDemandMetrics/constants';

import {createOnDemandFilterWarning, isOnDemandQueryString} from '.';

describe('isOnDemandQueryString', () => {
  it('should return true for a query that contains non-standard query keys', () => {
    expect(isOnDemandQueryString('transaction.duration:>1')).toBeTruthy();
    expect(isOnDemandQueryString('device.name:foo')).toBeTruthy();
    expect(isOnDemandQueryString('geo.region:>US')).toBeTruthy();
    expect(isOnDemandQueryString('foo:bar')).toBeTruthy();
  });

  it('should return false for an alert that has only standard fields', () => {
    expect(isOnDemandQueryString('release:1.0')).toBeFalsy();
    expect(isOnDemandQueryString('browser.name:chrome')).toBeFalsy();
  });
});

describe('createOnDemandFilterWarning', () => {
  it('should return the warning if the query key is not a standard search key', () => {
    const message = "This filter isn't supported";
    const getOnDemandFilterWarning = createOnDemandFilterWarning(message);

    expect(getOnDemandFilterWarning('transaction.duration')).toBe(message);
    expect(getOnDemandFilterWarning('user.email')).toBe(message);
    expect(getOnDemandFilterWarning('device.family')).toBe(message);
    expect(getOnDemandFilterWarning('foo.bar')).toBe(message);
  });

  it('should return null if the query key is a standard search key', () => {
    const message = "This filter isn't supported";
    const getOnDemandFilterWarning = createOnDemandFilterWarning(message);
    STANDARD_SEARCH_FIELD_KEYS.forEach(key => {
      expect(getOnDemandFilterWarning(key)).toBeNull();
    });
  });
});
