import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {isOnDemandMetricAlert} from 'sentry/views/alerts/rules/metric/utils/onDemandMetricAlert';

describe('isOnDemandMetricAlert', () => {
  it('should return true for an alert that contains non standard fields', () => {
    const dataset = Dataset.GENERIC_METRICS;

    expect(isOnDemandMetricAlert(dataset, 'transaction.duration:>1')).toBeTruthy();
    expect(isOnDemandMetricAlert(dataset, 'device.name:foo')).toBeTruthy();
    expect(isOnDemandMetricAlert(dataset, 'geo.region:>US')).toBeTruthy();
  });

  it('should return false for an alert that has only standard fields', () => {
    const dataset = Dataset.GENERIC_METRICS;

    expect(isOnDemandMetricAlert(dataset, 'release:1.0')).toBeFalsy();
    expect(isOnDemandMetricAlert(dataset, 'browser.name:chrome')).toBeFalsy();
  });

  it('should return false if dataset is not generic_metrics', () => {
    const dataset = Dataset.TRANSACTIONS;

    expect(isOnDemandMetricAlert(dataset, 'transaction.duration:>1')).toBeFalsy();
    expect(isOnDemandMetricAlert(dataset, 'device.name:foo')).toBeFalsy();
    expect(isOnDemandMetricAlert(dataset, 'geo.region:>US')).toBeFalsy();
  });
});
