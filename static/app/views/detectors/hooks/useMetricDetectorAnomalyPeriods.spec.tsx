import {initializeOrg} from 'sentry-test/initializeOrg';
import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
  Dataset,
  TimePeriod,
} from 'sentry/views/alerts/rules/metric/types';
import {AnomalyType, type Anomaly} from 'sentry/views/alerts/types';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import {useMetricDetectorAnomalyPeriods} from 'sentry/views/detectors/hooks/useMetricDetectorAnomalyPeriods';

const {organization} = initializeOrg();

describe('useMetricDetectorAnomalyPeriods', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('groups consecutive anomalies into incident periods', async () => {
    const mockAnomalies: Anomaly[] = [
      {
        timestamp: 1609459200,
        value: 100,
        anomaly: {anomaly_score: 0.8, anomaly_type: AnomalyType.HIGH_CONFIDENCE},
      },
      {
        timestamp: 1609462800,
        value: 120,
        anomaly: {anomaly_score: 0.9, anomaly_type: AnomalyType.HIGH_CONFIDENCE},
      },
      {
        timestamp: 1609466400,
        value: 90,
        anomaly: {anomaly_score: 0.1, anomaly_type: AnomalyType.NONE},
      },
      {
        timestamp: 1609470000,
        value: 150,
        anomaly: {anomaly_score: 0.95, anomaly_type: AnomalyType.HIGH_CONFIDENCE},
      },
    ];

    // Historical data
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      match: [MockApiClient.matchQuery({statsPeriod: '35d'})],
      body: {
        data: [
          [1607459200, [{count: 80}]],
          [1607462800, [{count: 95}]],
          [1607466400, [{count: 110}]],
          [1607470000, [{count: 75}]],
        ],
      },
    });

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
          {name: '1609462800000', value: 120},
          {name: '1609466400000', value: 90},
          {name: '1609470000000', value: 150},
        ],
      },
    ];

    const {result} = renderHookWithProviders(useMetricDetectorAnomalyPeriods, {
      initialProps: {
        series,
        detectorDataset: DetectorDataset.ERRORS,
        dataset: Dataset.ERRORS,
        aggregate: 'count()',
        query: '',
        eventTypes: [],
        environment: undefined,
        projectId: '1',
        statsPeriod: TimePeriod.SEVEN_DAYS,
        interval: 900, // 15 minutes
        thresholdType: AlertRuleThresholdType.ABOVE,
        sensitivity: AlertRuleSensitivity.MEDIUM,
        isLoadingSeries: false,
        enabled: true,
      },
    });

    await waitFor(() => {
      expect(anomalyRequest).toHaveBeenCalled();
    });

    // Should create two incident periods: first two consecutive anomalies, then one after the gap
    expect(result.current.anomalyPeriods).toHaveLength(2);
    expect(result.current.anomalyPeriods[0]).toEqual(
      expect.objectContaining({
        type: 'open-period-start',
        priority: 'high',
        start: 1609459200000,
        end: 1609462800000, // Last consecutive anomaly timestamp in ms
      })
    );
    expect(result.current.anomalyPeriods[1]).toEqual(
      expect.objectContaining({
        type: 'open-period-start',
        priority: 'high',
        start: 1609470000000,
        end: 1609470000000 + 900000, // Plus timePeriod (900s = 15min) in ms for minimum width
      })
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
