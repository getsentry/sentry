import type {ReactNode} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
  TimePeriod,
} from 'sentry/views/alerts/rules/metric/types';
import {type Anomaly, AnomalyType} from 'sentry/views/alerts/types';
import {DetectorDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {useMetricDetectorAnomalyPeriods} from 'sentry/views/detectors/hooks/useMetricDetectorAnomalyPeriods';
import {OrganizationContext} from 'sentry/views/organizationContext';

const {organization} = initializeOrg();

function TestContext({children}: {children?: ReactNode}) {
  return (
    <QueryClientProvider client={makeTestQueryClient()}>
      <OrganizationContext value={organization}>{children}</OrganizationContext>
    </QueryClientProvider>
  );
}

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

    const {result} = renderHook(
      () =>
        useMetricDetectorAnomalyPeriods({
          series,
          dataset: DetectorDataset.ERRORS,
          aggregate: 'count()',
          query: '',
          environment: undefined,
          projectId: '1',
          statsPeriod: TimePeriod.SEVEN_DAYS,
          timePeriod: 900, // 15 minutes
          thresholdType: AlertRuleThresholdType.ABOVE,
          sensitivity: AlertRuleSensitivity.MEDIUM,
          enabled: true,
        }),
      {wrapper: TestContext}
    );

    await waitFor(() => {
      expect(anomalyRequest).toHaveBeenCalled();
    });

    // Should create two incident periods: first two consecutive anomalies, then one after the gap
    expect(result.current.anomalyPeriods).toHaveLength(2);
    expect(result.current.anomalyPeriods[0]).toEqual(
      expect.objectContaining({
        type: AnomalyType.HIGH_CONFIDENCE,
        name: 'High Confidence Anomaly',
        start: 1609459200000,
        end: 1609462800000, // Last consecutive anomaly timestamp in ms
      })
    );
    expect(result.current.anomalyPeriods[1]).toEqual(
      expect.objectContaining({
        type: AnomalyType.HIGH_CONFIDENCE,
        name: 'High Confidence Anomaly',
        start: 1609470000000,
        end: 1609470000000 + 900000, // Plus timePeriod (900s = 15min) in ms for minimum width
      })
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
