import {
  AnomalyDetectionConditionGroupFixture,
  MetricDetectorFixture,
} from 'sentry-fixture/detectors';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  DataConditionGroupLogicType,
  DataConditionType,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';

import {MetricDetectorDetailsDetect} from './detect';

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
