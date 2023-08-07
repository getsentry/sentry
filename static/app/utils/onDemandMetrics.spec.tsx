import {isOnDemandQueryString} from './onDemandMetrics';

describe('isOnDemandQueryString', () => {
  it('should return true for a query that contains non-standard query keys', () => {
    expect(isOnDemandQueryString('transaction.duration:>1')).toBeTruthy();
    expect(isOnDemandQueryString('device.name:foo')).toBeTruthy();
    expect(isOnDemandQueryString('geo.region:>US')).toBeTruthy();
  });

  it('should return false for an alert that has only standard fields', () => {
    expect(isOnDemandQueryString('release:1.0')).toBeFalsy();
    expect(isOnDemandQueryString('browser.name:chrome')).toBeFalsy();
  });
});
