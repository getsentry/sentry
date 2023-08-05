import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {
  hasNonStandardMetricSearchFilters,
  isOnDemandMetricAlert,
} from 'sentry/views/alerts/rules/metric/utils/onDemandMetricAlert';

describe('isOnDemandMetricAlert', () => {
  it('should return true for an alert that contains non standard fields', () => {
    const dataset = Dataset.GENERIC_METRICS;

    expect(isOnDemandMetricAlert(dataset, 'transaction.duration:>1')).toBeTruthy();
    expect(isOnDemandMetricAlert(dataset, 'browser.version:>91')).toBeTruthy();
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
    expect(isOnDemandMetricAlert(dataset, 'browser.version:>91')).toBeFalsy();
    expect(isOnDemandMetricAlert(dataset, 'geo.region:>US')).toBeFalsy();
  });
});

describe('hasNonStandardMetricSearchFilters', () => {
  it('should return true for a query that contains non-standard query keys', () => {
    expect(hasNonStandardMetricSearchFilters('transaction.duration:>1')).toBeTruthy();
    expect(hasNonStandardMetricSearchFilters('browser.version:>91')).toBeTruthy();
    expect(hasNonStandardMetricSearchFilters('geo.region:>US')).toBeTruthy();
  });

  it('should return false for an alert that has only standard fields', () => {
    expect(hasNonStandardMetricSearchFilters('release:1.0')).toBeFalsy();
    expect(hasNonStandardMetricSearchFilters('browser.name:chrome')).toBeFalsy();
  });
});
