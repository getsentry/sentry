import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {
  GroupOpenPeriodActivityFixture,
  GroupOpenPeriodFixture,
} from 'sentry-fixture/groupOpenPeriod';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderHookWithProviders,
  screen,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {
  DataConditionGroupLogicType,
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
} from 'sentry/views/alerts/rules/metric/types';
import {
  MetricDetectorDetailsChart,
  useMetricDetectorChart,
} from 'sentry/views/detectors/components/details/metric/chart';

describe('MetricDetectorDetailsChart', () => {
  const detector = MetricDetectorFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/open-periods/',
      body: [],
    });
  });

  it('displays error alert and error panel when API request fails', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        detail: 'Invalid query: xyz',
      },
      statusCode: 400,
    });

    render(<MetricDetectorDetailsChart detector={detector} />);

    expect(await screen.findByText('Invalid query: xyz')).toBeInTheDocument();
    expect(screen.getByText('Error loading chart data')).toBeInTheDocument();
  });

  describe('anomaly threshold cutoff message', () => {
    const organization = OrganizationFixture({
      features: ['visibility-explore-view'],
    });

    const anomalyDetector = MetricDetectorFixture({
      config: {detectionType: 'dynamic'},
      conditionGroup: {
        id: '1',
        logicType: DataConditionGroupLogicType.ANY,
        conditions: [
          {
            id: '1',
            type: DataConditionType.ANOMALY_DETECTION,
            comparison: {
              sensitivity: AlertRuleSensitivity.HIGH,
              seasonality: 'auto',
              thresholdType: AlertRuleThresholdType.ABOVE_AND_BELOW,
            },
            conditionResult: DetectorPriorityLevel.HIGH,
          },
        ],
      },
    });

    const baseTimestamp = Date.now() / 1000;
    const CUTOFF_MESSAGE = 'Some anomaly thresholds are outside the chart area';

    function mockChartData() {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {data: [[baseTimestamp, [{count: 100}]]]},
      });
    }

    function mockAnomalyData(yhatUpper: number) {
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/detectors/${anomalyDetector.id}/anomaly-data/`,
        body: {
          data: [
            {
              timestamp: baseTimestamp,
              value: 50,
              yhat_upper: yhatUpper,
              yhat_lower: 10,
            },
          ],
        },
      });
    }

    it('does not show cutoff message when thresholds are within chart bounds', async () => {
      mockChartData();
      mockAnomalyData(105); // Within bounds (max 100 + 10% padding = 110)

      render(<MetricDetectorDetailsChart detector={anomalyDetector} />, {organization});

      expect(
        await screen.findByRole('button', {name: 'Open in Discover'})
      ).toBeInTheDocument();
      expect(screen.queryByText(CUTOFF_MESSAGE)).not.toBeInTheDocument();
    });

    it('shows cutoff message when thresholds exceed chart bounds', async () => {
      mockChartData();
      mockAnomalyData(500); // yhat_upper exceeds bounds (max ~110)

      render(<MetricDetectorDetailsChart detector={anomalyDetector} />, {organization});

      expect(await screen.findByText(CUTOFF_MESSAGE)).toBeInTheDocument();
    });
  });
});

describe('useMetricDetectorChart', () => {
  const detector = MetricDetectorFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('extends an active open period to the end of the chart', async () => {
    const intervalSeconds = detector.dataSources[0].queryObj.snubaQuery.timeWindow;
    const lastBucketStartSeconds = Date.parse('2026-09-22T17:30:00Z') / 1000;
    const openPeriod = GroupOpenPeriodFixture({
      end: null,
      isOpen: true,
      start: '2026-09-22T17:29:00Z',
      activities: [
        GroupOpenPeriodActivityFixture({
          dateCreated: '2026-09-22T17:29:00Z',
          type: 'opened',
          value: 'medium',
        }),
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: EventsStatsFixture({
        data: [
          [lastBucketStartSeconds - intervalSeconds, [{count: 10}]],
          [lastBucketStartSeconds, [{count: 20}]],
        ],
      }),
    });

    const {result} = renderHookWithProviders(() =>
      useMetricDetectorChart({detector, openPeriods: [openPeriod]})
    );

    await waitFor(() => {
      const chartEndTimestampMs = result.current.chartProps?.series[0]?.data.at(-1)?.name;
      const openPeriodSeries = result.current.chartProps?.additionalSeries?.find(
        series => series.name === 'Open Periods'
      );

      expect(chartEndTimestampMs).toEqual(expect.any(Number));
      expect(openPeriodSeries).toMatchObject({
        data: expect.arrayContaining([
          expect.objectContaining({
            end: chartEndTimestampMs,
            id: openPeriod.id,
            type: 'open-period-start',
          }),
        ]),
      });
    });
  });
});
