import {
  AnomalyDetectionConditionGroupFixture,
  MetricDetectorFixture,
  SnubaQueryDataSourceFixture,
} from 'sentry-fixture/detectors';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  DataConditionGroupLogicType,
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';

import {MetricDetectorDetailsDetect} from './detect';

function traceMetricDetector(aggregate: string) {
  return MetricDetectorFixture({
    dataSources: [
      SnubaQueryDataSourceFixture({
        queryObj: {
          id: '1',
          status: 1,
          subscription: '1',
          snubaQuery: {
            aggregate,
            dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
            eventTypes: [EventTypes.TRACE_ITEM_METRIC],
            id: '',
            query: '',
            timeWindow: 3600,
          },
        },
      }),
    ],
  });
}

describe('MetricDetectorDetailsDetect', () => {
  it('renders dataset, visualize, where, interval, and threshold', () => {
    const detector = MetricDetectorFixture();

    render(<MetricDetectorDetailsDetect detector={detector} />);

    // Dataset
    expect(screen.getByText('Dataset:')).toBeInTheDocument();
    expect(screen.getByText('Errors')).toBeInTheDocument();

    // Visualize (aggregate)
    expect(screen.getByText('Visualize')).toBeInTheDocument();
    // Aggregate function
    expect(screen.getByText('count()')).toBeInTheDocument();
    // Query
    expect(screen.getByText('Where')).toBeInTheDocument();
    expect(screen.getByLabelText('is:unresolved')).toBeInTheDocument();

    // Interval is 60s by default in fixture
    expect(screen.getByText('Interval:')).toBeInTheDocument();
    expect(screen.getByText('1 minute')).toBeInTheDocument();

    // Threshold label for static detection
    expect(screen.getByText('Threshold:')).toBeInTheDocument();
    expect(screen.getByText('Static threshold')).toBeInTheDocument();
  });

  it('renders a trace metric equation using its reference labels', async () => {
    const expression =
      'sum_if(`user.id:bc`,value,page.view,counter,none) + per_minute(value,checkout,counter,none)';
    const detector = traceMetricDetector(`equation|${expression}`);

    render(<MetricDetectorDetailsDetect detector={detector} />);

    expect(screen.getByText('A + B')).toBeInTheDocument();
    expect(screen.queryByText(expression)).not.toBeInTheDocument();

    await userEvent.hover(screen.getByText('A + B'));

    // Each aggregate is broken out under its own header
    expect(await screen.findByText('Application Metric')).toBeInTheDocument();
    expect(screen.getByText('Operation')).toBeInTheDocument();
    expect(screen.getByText('Filter')).toBeInTheDocument();

    // A: `_if` split into an operation and a filter
    expect(screen.getByText('page.view')).toBeInTheDocument();
    expect(screen.getByText('sum')).toBeInTheDocument();
    expect(screen.getByText('user.id:bc')).toBeInTheDocument();

    // B: unfiltered, so it reads as an em dash
    expect(screen.getByText('checkout')).toBeInTheDocument();
    expect(screen.getByText('per_minute')).toBeInTheDocument();
    expect(screen.getByText('\u2014')).toBeInTheDocument();
  });

  it('tightens parentheses in the compact equation', () => {
    const detector = traceMetricDetector(
      'equation|(sum(value,page.view,counter,none) + sum(value,checkout,counter,none)) / sum(value,errors,counter,none)'
    );

    render(<MetricDetectorDetailsDetect detector={detector} />);

    expect(screen.getByText('(A + B) / C')).toBeInTheDocument();
  });

  it('renders a single trace metric aggregate as is', () => {
    const detector = traceMetricDetector('sum(value,page.view,counter,none)');

    render(<MetricDetectorDetailsDetect detector={detector} />);

    expect(screen.getByText('sum(value,page.view,counter,none)')).toBeInTheDocument();
  });

  it('renders human readable priority conditions for static detection', () => {
    const detector = MetricDetectorFixture();

    render(<MetricDetectorDetailsDetect detector={detector} />);

    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText(/Above 8/)).toBeInTheDocument();

    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.getByText(/Below or equal to 8/)).toBeInTheDocument();
  });

  it('renders percent change description with delta window', () => {
    const detector = MetricDetectorFixture({
      config: {detectionType: 'percent', comparisonDelta: 60},
      // Percent thresholds are stored as absolute percentages internally:
      // 108 = "8% higher" (108% of baseline), 92 for resolution = "8% lower" (100 - 92)
      conditionGroup: {
        conditions: [
          {
            id: '1',
            type: DataConditionType.GREATER,
            comparison: 108,
            conditionResult: DetectorPriorityLevel.HIGH,
          },
          {
            id: '2',
            type: DataConditionType.LESS_OR_EQUAL,
            comparison: 92,
            conditionResult: DetectorPriorityLevel.OK,
          },
        ],
        id: '1',
        logicType: DataConditionGroupLogicType.ANY,
      },
    });

    render(<MetricDetectorDetailsDetect detector={detector} />);

    expect(screen.getByText('Percent change')).toBeInTheDocument();
    expect(screen.getByText(/8% higher than the previous 1 minute/)).toBeInTheDocument();

    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(
      screen.getByText(/Below or equal to 8% lower than the previous 1 minute/)
    ).toBeInTheDocument();
  });

  it('renders percent change description when resolution comparison matches alert', () => {
    const detector = MetricDetectorFixture({
      config: {detectionType: 'percent', comparisonDelta: 604800},
      conditionGroup: {
        conditions: [
          {
            id: '1',
            type: DataConditionType.GREATER,
            comparison: 110,
            conditionResult: DetectorPriorityLevel.HIGH,
          },
          {
            id: '2',
            type: DataConditionType.LESS_OR_EQUAL,
            comparison: 110,
            conditionResult: DetectorPriorityLevel.OK,
          },
        ],
        id: '1',
        logicType: DataConditionGroupLogicType.ANY,
      },
    });

    render(<MetricDetectorDetailsDetect detector={detector} />);

    expect(screen.getByText('10% higher than the previous 1 week')).toBeInTheDocument();
    expect(
      screen.getByText('Below or equal to 10% higher than the previous 1 week')
    ).toBeInTheDocument();
  });

  it('renders dynamic detection', () => {
    const detector = MetricDetectorFixture({
      config: {detectionType: 'dynamic'},
      conditionGroup: AnomalyDetectionConditionGroupFixture(),
    });

    render(<MetricDetectorDetailsDetect detector={detector} />);

    expect(screen.getByText('Dynamic threshold')).toBeInTheDocument();
    expect(screen.getByText('Trend: Above and Below')).toBeInTheDocument();
    expect(screen.getByText('Responsiveness: High')).toBeInTheDocument();
  });
});
