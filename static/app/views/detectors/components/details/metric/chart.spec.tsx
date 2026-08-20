import {
  MetricDetectorFixture,
  SnubaQueryDataSourceFixture,
} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {AreaChart} from 'sentry/components/charts/areaChart';
import {
  DataConditionGroupLogicType,
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
  Dataset,
  EventTypes,
} from 'sentry/views/alerts/rules/metric/types';
import {MetricDetectorDetailsChart} from 'sentry/views/detectors/components/details/metric/chart';

jest.mock('sentry/components/charts/areaChart', () => ({
  AreaChart: jest.fn().mockImplementation(() => <div data-test-id="area-chart" />),
}));

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

  it('summarizes a trace metric equation in the chart tooltip', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: [[Date.now() / 1000, [{count: 100}]]]},
    });

    const equationDetector = MetricDetectorFixture({
      dataSources: [
        SnubaQueryDataSourceFixture({
          queryObj: {
            id: '1',
            status: 1,
            subscription: '1',
            snubaQuery: {
              aggregate:
                'equation|sum_if(`user.id:bc`,value,page.view,counter,none) + per_minute(value,checkout,counter,none)',
              dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
              eventTypes: [EventTypes.TRACE_ITEM_METRIC],
              id: '',
              query: 'env:prod',
              timeWindow: 3600,
            },
          },
        }),
      ],
    });

    render(<MetricDetectorDetailsChart detector={equationDetector} />);

    await waitFor(() => expect(AreaChart).toHaveBeenCalled());
    const {tooltip} = jest.mocked(AreaChart).mock.calls.at(-1)![0];

    // The series name is the raw aggregate; the tooltip shows the summary and the
    // filter the whole equation runs under
    let name = '';
    act(() => {
      name =
        tooltip?.nameFormatter?.('sum_if(`user.id:bc`,value,page.view,counter,none)') ??
        '';
    });
    expect(name).toContain('A + B');
    expect(name).toContain('Where');
    expect(name).toContain('env:prod');
    expect(name).not.toContain('sum_if(');

    // In the app this runs from echarts' tooltip callback, outside React's render
    let details = '';
    act(() => {
      details = tooltip?.renderSeriesDetails?.() ?? '';
    });
    expect(details).toContain('Application Metric');
    expect(details).toContain('Operation');
    expect(details).toContain('Filter');
    expect(details).toContain('page.view');
    expect(details).toContain('user.id:bc');
    expect(details).toContain('per_minute');
  });

  it('escapes the filter it renders into the tooltip html', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: [[Date.now() / 1000, [{count: 100}]]]},
    });

    const detectorWithHtmlInQuery = MetricDetectorFixture({
      dataSources: [
        SnubaQueryDataSourceFixture({
          queryObj: {
            id: '1',
            status: 1,
            subscription: '1',
            snubaQuery: {
              aggregate:
                'equation|sum(value,page.view,counter,none) + sum(value,checkout,counter,none)',
              dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
              eventTypes: [EventTypes.TRACE_ITEM_METRIC],
              id: '',
              query: 'user.id:"<img src=x onerror=alert(1)>"',
              timeWindow: 3600,
            },
          },
        }),
      ],
    });

    render(<MetricDetectorDetailsChart detector={detectorWithHtmlInQuery} />);

    await waitFor(() => expect(AreaChart).toHaveBeenCalled());
    const {tooltip} = jest.mocked(AreaChart).mock.calls.at(-1)![0];

    let name = '';
    act(() => {
      name = tooltip?.nameFormatter?.('') ?? '';
    });

    expect(name).not.toContain('<img');
    expect(name).toContain('&lt;img');
  });
});
