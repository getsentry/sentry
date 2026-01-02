import {
  AnomalyDetectionConditionGroupFixture,
  MetricDetectorFixture,
} from 'sentry-fixture/detectors';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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
    });

    render(<MetricDetectorDetailsDetect detector={detector} />);

    expect(screen.getByText('Percent change')).toBeInTheDocument();
    expect(screen.getByText(/8% higher than the previous 1 minute/)).toBeInTheDocument();

    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(
      screen.getByText(/Below or equal to 8% lower than the previous 1 minute/)
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
