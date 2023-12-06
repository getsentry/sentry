import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {isOnDemandMetricAlert} from 'sentry/views/alerts/rules/metric/utils/onDemandMetricAlert';

describe('isOnDemandMetricAlert', () => {
  it('should return true for an alert that contains non standard fields', () => {
    const dataset = Dataset.GENERIC_METRICS;

    expect(
      isOnDemandMetricAlert(dataset, 'count()', 'transaction.duration:>1')
    ).toBeTruthy();
    expect(isOnDemandMetricAlert(dataset, 'count()', 'device.name:foo')).toBeTruthy();
    expect(isOnDemandMetricAlert(dataset, 'count()', 'geo.region:>US')).toBeTruthy();
  });

  it('should return false for an alert that has only standard fields', () => {
    const dataset = Dataset.GENERIC_METRICS;

    expect(isOnDemandMetricAlert(dataset, 'count()', 'release:1.0')).toBeFalsy();
    expect(isOnDemandMetricAlert(dataset, 'count()', 'browser.name:chrome')).toBeFalsy();
  });

  it('should return false if dataset is not generic_metrics', () => {
    const dataset = Dataset.TRANSACTIONS;

    expect(
      isOnDemandMetricAlert(dataset, 'count()', 'transaction.duration:>1')
    ).toBeFalsy();
    expect(isOnDemandMetricAlert(dataset, 'count()', 'device.name:foo')).toBeFalsy();
    expect(isOnDemandMetricAlert(dataset, 'count()', 'geo.region:>US')).toBeFalsy();
  });

  it('should return true if aggregate is apdex', () => {
    const dataset = Dataset.GENERIC_METRICS;

    expect(isOnDemandMetricAlert(dataset, 'apdex(300)', '')).toBeTruthy();
    expect(
      isOnDemandMetricAlert(dataset, 'apdex(300)', 'transaction.duration:>1')
    ).toBeTruthy();
    expect(isOnDemandMetricAlert(dataset, 'apdex(300)', 'device.name:foo')).toBeTruthy();
  });

  it('should return false for an alert that uses custom metrics', () => {
    const dataset = Dataset.GENERIC_METRICS;

    expect(
      isOnDemandMetricAlert(dataset, 'avg(c:custom/some.custom_counter)', 'release:1.0')
    ).toBeFalsy();
    expect(
      isOnDemandMetricAlert(
        dataset,
        'count(d:custom/more.custom_stuff)',
        'browser.name:chrome'
      )
    ).toBeFalsy();
  });
});
