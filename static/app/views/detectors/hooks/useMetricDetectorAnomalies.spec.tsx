import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
} from 'sentry/views/alerts/rules/metric/types';
import {AnomalyType, type Anomaly} from 'sentry/views/alerts/types';
import {useMetricDetectorAnomalies} from 'sentry/views/detectors/hooks/useMetricDetectorAnomalies';

const organization = OrganizationFixture();

describe('useMetricDetectorAnomalies', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('transforms series data and returns anomaly response', async () => {
    const mockAnomalies: Anomaly[] = [
      {
        timestamp: 1609459200,
        value: 100,
        anomaly: {anomaly_score: 0.8, anomaly_type: AnomalyType.HIGH_CONFIDENCE},
      },
      {
        timestamp: 1609462800,
        value: 150,
        anomaly: {anomaly_score: 0.9, anomaly_type: AnomalyType.HIGH_CONFIDENCE},
      },
    ];

    const anomalyRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/anomalies/`,
      method: 'POST',
      body: mockAnomalies,
    });

    const series = [
      {
        seriesName: 'count()',
        data: [
          {name: '1609459200000', value: 100},
          {name: '1609462800000', value: 150},
        ],
      },
    ];

    const historicalSeries = [
      {
        seriesName: 'count()',
        data: [
          {name: '1607459200000', value: 80},
          {name: '1607462800000', value: 95},
        ],
      },
    ];

    const {result} = renderHookWithProviders(useMetricDetectorAnomalies, {
      initialProps: {
        series,
        historicalSeries,
        thresholdType: AlertRuleThresholdType.ABOVE,
        sensitivity: AlertRuleSensitivity.MEDIUM,
        interval: 900, // 15 minutes
        projectId: '1',
        enabled: true,
      },
    });

    await waitFor(() => {
      expect(anomalyRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/events/anomalies/`,
        expect.objectContaining({
          method: 'POST',
          data: expect.objectContaining({
            organization_id: organization.id,
            project_id: '1',
            config: expect.objectContaining({
              expected_seasonality: 'auto',
              sensitivity: 'medium',
              time_period: 15,
            }),
            current_data: [
              [1609459200, {count: 100}],
              [1609462800, {count: 150}],
            ],
            historical_data: [
              [1607459200, {count: 80}],
              [1607462800, {count: 95}],
            ],
          }),
        })
      );
    });

    expect(result.current.data).toEqual(mockAnomalies);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
