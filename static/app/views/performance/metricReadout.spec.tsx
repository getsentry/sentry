import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fields';
import {MetricReadout} from 'sentry/views/performance/metricReadout';

describe('MetricReadout', function () {
  it('shows a loading spinner if data is loading', () => {
    render(
      <MetricReadout
        title="Duration"
        unit={DurationUnit.MILLISECOND}
        value={undefined}
        isLoading
      />
    );

    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('shows placeholder text if data is missing', () => {
    render(
      <MetricReadout title="Duration" unit={DurationUnit.MILLISECOND} value={undefined} />
    );

    expect(screen.getByRole('heading', {name: 'Duration'})).toBeInTheDocument();
    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('parses strings', () => {
    render(<MetricReadout title="Rate" unit={RateUnit.PER_MINUTE} value={'17.8'} />);

    expect(screen.getByRole('heading', {name: 'Rate'})).toBeInTheDocument();
    expect(screen.getByText('17.8/min')).toBeInTheDocument();
  });

  it('renders rates', () => {
    render(<MetricReadout title="Rate" unit={RateUnit.PER_MINUTE} value={17.8} />);

    expect(screen.getByRole('heading', {name: 'Rate'})).toBeInTheDocument();
    expect(screen.getByText('17.8/min')).toBeInTheDocument();
  });

  it('renders milliseconds', () => {
    render(
      <MetricReadout title="Duration" unit={DurationUnit.MILLISECOND} value={223142123} />
    );

    expect(screen.getByRole('heading', {name: 'Duration'})).toBeInTheDocument();
    expect(screen.getByText('2.58d')).toBeInTheDocument();
  });

  it('renders bytes', () => {
    render(<MetricReadout title="Size" unit={SizeUnit.BYTE} value={1172316} />);

    expect(screen.getByRole('heading', {name: 'Size'})).toBeInTheDocument();
    expect(screen.getByText('1.1 MiB')).toBeInTheDocument();
  });

  it('renders counts', () => {
    render(<MetricReadout title="Count" unit="count" value={7800123} />);

    expect(screen.getByRole('heading', {name: 'Count'})).toBeInTheDocument();
    expect(screen.getByText('7.8m')).toBeInTheDocument();
  });
});
