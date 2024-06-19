import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fields';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';

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

  it('limits smallest rate', () => {
    render(<MetricReadout title="Rate" unit={RateUnit.PER_MINUTE} value={0.0002441} />);

    expect(screen.getByRole('heading', {name: 'Rate'})).toBeInTheDocument();
    expect(screen.getByText('<0.01/min')).toBeInTheDocument();
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

  it('renders percentages', () => {
    render(<MetricReadout title="Percentage" unit="percentage" value={0.2352} />);

    expect(screen.getByRole('heading', {name: 'Percentage'})).toBeInTheDocument();
    expect(screen.getByText('23.52%')).toBeInTheDocument();
  });

  it('limits smallest percentage', () => {
    render(<MetricReadout title="Percentage" unit="percentage" value={0.000022317} />);

    expect(screen.getByRole('heading', {name: 'Percentage'})).toBeInTheDocument();
    expect(screen.getByText('<0.01%')).toBeInTheDocument();
  });

  describe('percent_change', () => {
    it('renders negative percent change', () => {
      render(
        <MetricReadout title="% Difference" unit="percent_change" value={-0.2352} />
      );

      expect(screen.getByRole('heading', {name: '% Difference'})).toBeInTheDocument();
      expect(screen.getByText('-23.52%')).toBeInTheDocument();
    });

    it('renders positive percent change', () => {
      render(<MetricReadout title="% Difference" unit="percent_change" value={0.0552} />);

      expect(screen.getByRole('heading', {name: '% Difference'})).toBeInTheDocument();
      expect(screen.getByText('+5.52%')).toBeInTheDocument();
    });

    it('respects preferred negative polarity', () => {
      render(
        <MetricReadout
          title="% Difference"
          unit="percent_change"
          value={0.0552}
          preferredPolarity="-"
        />
      );

      expect(screen.getByText('+5.52%')).toHaveAttribute('data-rating', 'bad');
    });

    it('respects preferred default polarity', () => {
      render(<MetricReadout title="% Difference" unit="percent_change" value={0.0552} />);

      expect(screen.getByText('+5.52%')).toHaveAttribute('data-rating', 'good');
    });
  });

  it('renders counts', () => {
    render(<MetricReadout title="Count" unit="count" value={7800123} />);

    expect(screen.getByRole('heading', {name: 'Count'})).toBeInTheDocument();
    expect(screen.getByText('7.8m')).toBeInTheDocument();
  });
});
