import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  smartRound,
  useMetricDetectorAnomalyThresholds,
} from 'sentry/views/detectors/hooks/useMetricDetectorAnomalyThresholds';

describe('smartRound', () => {
  it('rounds by magnitude while preserving small fractional values', () => {
    expect(smartRound(123.4)).toBe(123);
    expect(smartRound(12.34)).toBe(12.3);
    expect(smartRound(1.234)).toBe(1.23);
    expect(smartRound(0.1234)).toBe(0.123);
    expect(smartRound(0.01234)).toBe(0.0123);
    expect(smartRound(0.0087)).toBe(0.0087);
    expect(smartRound(0.0012)).toBe(0.0012);
    expect(smartRound(-12.34)).toBe(-12.3);
  });
});

describe('useMetricDetectorAnomalyThresholds', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('does not fetch data when detectionType is not dynamic', () => {
    const organization = OrganizationFixture();

    const anomalyDataRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/123/anomaly-data/`,
      body: {data: []},
    });

    const series = [
      {
        seriesName: 'count()',
        data: [{name: 1609459200000, value: 100}],
      },
    ];

    renderHookWithProviders(
      () =>
        useMetricDetectorAnomalyThresholds({
          detectorId: '123',
          detectionType: 'static',
          startTimestamp: 1609459200,
          endTimestamp: 1609545600,
          series,
        }),
      {organization}
    );

    expect(anomalyDataRequest).not.toHaveBeenCalled();
  });

  it('fetches data when detectionType is dynamic', async () => {
    const organization = OrganizationFixture();

    const mockData = [
      {
        external_alert_id: 24,
        timestamp: 1609459200,
        value: 100,
        yhat_lower: 80,
        yhat_upper: 120,
      },
    ];

    const anomalyDataRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/123/anomaly-data/`,
      body: {data: mockData},
    });

    const series = [
      {
        seriesName: 'count()',
        data: [{name: 1609459200000, value: 100}],
      },
    ];

    renderHookWithProviders(
      () =>
        useMetricDetectorAnomalyThresholds({
          detectorId: '123',
          detectionType: 'dynamic',
          startTimestamp: 1609459200,
          endTimestamp: 1609545600,
          series,
        }),
      {organization}
    );

    await waitFor(() => {
      expect(anomalyDataRequest).toHaveBeenCalled();
    });
  });

  it('does not fetch data when detectionType is undefined', () => {
    const organization = OrganizationFixture();

    const anomalyDataRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/123/anomaly-data/`,
      body: {data: []},
    });

    const series = [
      {
        seriesName: 'count()',
        data: [{name: 1609459200000, value: 100}],
      },
    ];

    renderHookWithProviders(
      () =>
        useMetricDetectorAnomalyThresholds({
          detectorId: '123',
          detectionType: undefined,
          startTimestamp: 1609459200,
          endTimestamp: 1609545600,
          series,
        }),
      {organization}
    );

    expect(anomalyDataRequest).not.toHaveBeenCalled();
  });

  it('smart-rounds anomaly bounds and preserves small fractional values', async () => {
    const organization = OrganizationFixture();

    const mockData = [
      {
        external_alert_id: 24,
        timestamp: 1609459200,
        value: 0.004,
        yhat_lower: 0.0012,
        yhat_upper: 0.0087,
      },
      {
        external_alert_id: 24,
        timestamp: 1609459260,
        value: 120.4,
        yhat_lower: 12.34,
        yhat_upper: 120.4,
      },
    ];

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/123/anomaly-data/`,
      body: {data: mockData},
    });

    const series = [
      {
        seriesName: 'p75(browser.web_vital.cls.value)',
        data: [
          {name: 1609459200000, value: 0.004},
          {name: 1609459260000, value: 120.4},
        ],
      },
    ];

    const {result} = renderHookWithProviders(
      () =>
        useMetricDetectorAnomalyThresholds({
          detectorId: '123',
          detectionType: 'dynamic',
          startTimestamp: 1609459200,
          endTimestamp: 1609545600,
          series,
        }),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.anomalyThresholdSeries).toHaveLength(2);
    });

    const [upperSeries, lowerSeries] = result.current.anomalyThresholdSeries;
    expect(upperSeries?.data).toEqual([
      [1609459200000, 0.0087],
      [1609459260000, 120],
    ]);
    expect(lowerSeries?.data).toEqual([
      [1609459200000, 0.0012],
      [1609459260000, 12.3],
    ]);
  });
});
