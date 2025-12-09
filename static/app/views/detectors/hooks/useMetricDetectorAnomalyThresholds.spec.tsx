import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useMetricDetectorAnomalyThresholds} from 'sentry/views/detectors/hooks/useMetricDetectorAnomalyThresholds';

describe('useMetricDetectorAnomalyThresholds', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('does not fetch data when detectionType is not dynamic', () => {
    const organization = OrganizationFixture({
      features: ['anomaly-detection-threshold-data'],
    });

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
    const organization = OrganizationFixture({
      features: ['anomaly-detection-threshold-data'],
    });

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
    const organization = OrganizationFixture({
      features: ['anomaly-detection-threshold-data'],
    });

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
});
