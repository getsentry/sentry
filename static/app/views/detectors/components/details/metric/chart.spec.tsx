import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  DataConditionGroupLogicType,
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
} from 'sentry/views/alerts/rules/metric/types';
import {MetricDetectorDetailsChart} from 'sentry/views/detectors/components/details/metric/chart';

describe('MetricDetectorDetailsChart', () => {
  const detector = MetricDetectorFixture();
  const snubaQuery = detector.dataSources[0].queryObj.snubaQuery;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/open-periods/',
      body: [],
    });
  });

  it('displays error alert and error panel when API request fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/events-stats/`,
      body: {
        detail: 'Invalid query: xyz',
      },
      statusCode: 400,
    });

    render(<MetricDetectorDetailsChart detector={detector} snubaQuery={snubaQuery} />);

    expect(await screen.findByText('Invalid query: xyz')).toBeInTheDocument();
    expect(screen.getByText('Error loading chart data')).toBeInTheDocument();
  });

  describe('anomaly threshold cutoff message', () => {
    const organization = OrganizationFixture({
      features: ['anomaly-detection-threshold-data', 'visibility-explore-view'],
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
    const anomalySnubaQuery = anomalyDetector.dataSources[0].queryObj.snubaQuery;

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

      render(
        <MetricDetectorDetailsChart
          detector={anomalyDetector}
          snubaQuery={anomalySnubaQuery}
        />,
        {organization}
      );

      expect(
        await screen.findByRole('button', {name: 'Open in Discover'})
      ).toBeInTheDocument();
      expect(screen.queryByText(CUTOFF_MESSAGE)).not.toBeInTheDocument();
    });

    it('shows cutoff message when thresholds exceed chart bounds', async () => {
      mockChartData();
      mockAnomalyData(500); // yhat_upper exceeds bounds (max ~110)

      render(
        <MetricDetectorDetailsChart
          detector={anomalyDetector}
          snubaQuery={anomalySnubaQuery}
        />,
        {organization}
      );

      expect(await screen.findByText(CUTOFF_MESSAGE)).toBeInTheDocument();
    });
  });
});
