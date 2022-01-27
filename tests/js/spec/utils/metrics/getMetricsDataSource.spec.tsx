import localStorage from 'sentry/utils/localStorage';
import {getMetricsDataSource} from 'sentry/utils/metrics/getMetricsDataSource';

describe('getMetricsDataSource', () => {
  beforeEach(() => {
    localStorage.removeItem('metrics.datasource');
  });
  it('retrieves the values from localStorage', () => {
    localStorage.setItem('metrics.datasource', 'snuba');
    expect(getMetricsDataSource()).toBe('snuba');

    localStorage.setItem('metrics.datasource', 'mock');
    expect(getMetricsDataSource()).toBe('mock');
  });
  it('defaults to undefined', () => {
    expect(getMetricsDataSource()).toBe(undefined);
  });
  it('discards unknown values', () => {
    localStorage.setItem('metrics.datasource', 'abc');
    expect(getMetricsDataSource()).toBe(undefined);
  });
});
