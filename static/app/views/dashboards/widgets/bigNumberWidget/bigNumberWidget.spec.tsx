import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {BigNumberWidget} from 'sentry/views/dashboards/widgets/bigNumberWidget/bigNumberWidget';

describe('BigNumberWidget', () => {
  describe('Layout', () => {
    it('Renders', () => {
      render(
        <BigNumberWidget
          title="EPS"
          description="Number of events per second"
          data={[
            {
              'eps()': 0.01087819860850493,
            },
          ]}
          meta={{
            fields: {
              'eps()': 'rate',
            },
            units: {
              'eps()': '1/second',
            },
          }}
        />
      );

      expect(screen.getByText('0.0109/s')).toBeInTheDocument();
    });
  });

  describe('Visualization', () => {
    it('Explains missing data', () => {
      render(
        <BigNumberWidget
          data={[{}]}
          meta={{
            fields: {
              'p95(span.duration)': 'number',
            },
          }}
        />
      );

      expect(screen.getByText('No Data')).toBeInTheDocument();
    });

    it('Explains non-numeric data', () => {
      render(
        <BigNumberWidget
          data={[
            {
              'count()': Infinity,
            },
          ]}
          meta={{
            fields: {
              'count()': 'number',
            },
          }}
        />
      );

      expect(screen.getByText('Value is not a finite number.')).toBeInTheDocument();
    });

    it('Formats duration data', () => {
      render(
        <BigNumberWidget
          data={[
            {
              'p95(span.duration)': 17.28,
            },
          ]}
          meta={{
            fields: {
              'p95(span.duration)': 'duration',
            },
            units: {
              'p95(span.duration)': 'milliseconds',
            },
          }}
        />
      );

      expect(screen.getByText('17.28ms')).toBeInTheDocument();
    });

    it('Shows the full unformatted value on hover', async () => {
      render(
        <BigNumberWidget
          data={[
            {
              'count()': 178451214,
            },
          ]}
          meta={{
            fields: {
              'count()': 'integer',
            },
            units: {
              'count()': null,
            },
          }}
        />
      );

      await userEvent.hover(screen.getByText('178m'));

      expect(screen.getByText('178451214')).toBeInTheDocument();
    });

    it('Respect maximum value', () => {
      render(
        <BigNumberWidget
          title="Count"
          data={[
            {
              'count()': 178451214,
            },
          ]}
          maximumValue={100000000}
          meta={{
            fields: {
              'count()': 'integer',
            },
          }}
        />
      );

      expect(screen.getByText(textWithMarkupMatcher('>100m'))).toBeInTheDocument();
    });
  });

  describe('State', () => {
    it('Shows a loading placeholder', () => {
      render(<BigNumberWidget isLoading />);

      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('Loading state takes precedence over error state', () => {
      render(
        <BigNumberWidget isLoading error={new Error('Parsing error of old value')} />
      );

      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('Shows an error message', () => {
      render(<BigNumberWidget error={new Error('Uh oh')} />);

      expect(screen.getByText('Error: Uh oh')).toBeInTheDocument();
    });

    it('Shows a retry button', async () => {
      const onRetry = jest.fn();

      render(<BigNumberWidget error={new Error('Oh no!')} onRetry={onRetry} />);

      await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('Hides other actions if there is an error and a retry handler', () => {
      const onRetry = jest.fn();

      render(
        <BigNumberWidget
          error={new Error('Oh no!')}
          onRetry={onRetry}
          actions={[
            {
              key: 'Open in Discover',
              to: '/discover',
            },
          ]}
        />
      );

      expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
      expect(
        screen.queryByRole('link', {name: 'Open in Discover'})
      ).not.toBeInTheDocument();
    });
  });

  describe('Previous Period Data', () => {
    it('Shows the difference between the current and previous data', () => {
      render(
        <BigNumberWidget
          title="http_response_code_rate(500)"
          data={[
            {
              'http_response_code_rate(500)': 0.14227123,
            },
          ]}
          previousPeriodData={[
            {
              'http_response_code_rate(500)': 0.1728139,
            },
          ]}
          meta={{
            fields: {
              'http_response_code_rate(500)': 'percentage',
            },
            units: {
              'http_response_code_rate(500)': null,
            },
          }}
        />
      );

      expect(screen.getByText('14.23%')).toBeInTheDocument();
      expect(screen.getByText('3.05%')).toBeInTheDocument();
    });
  });

  describe('Thresholds', () => {
    it('Evaluates the current value against a threshold', () => {
      render(
        <BigNumberWidget
          data={[
            {
              'eps()': 14.227123,
            },
          ]}
          meta={{
            fields: {
              'eps()': 'rate',
            },
            units: {
              'eps()': '1/second',
            },
          }}
          thresholds={{
            max_values: {
              max1: 10,
              max2: 20,
            },
            unit: '1/second',
          }}
        />
      );

      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'meh');
    });

    it('Normalizes the units', () => {
      render(
        <BigNumberWidget
          data={[
            {
              'mystery_error_rate()': 135, //  2.25/s
            },
          ]}
          meta={{
            fields: {
              'mystery_error_rate()': 'rate',
            },
            units: {
              'mystery_error_rate()': '1/minute',
            },
          }}
          thresholds={{
            max_values: {
              max1: 2,
              max2: 5,
            },
            unit: '1/second',
          }}
        />
      );

      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'meh');
    });

    it('Respects the preferred polarity', () => {
      render(
        <BigNumberWidget
          data={[
            {
              'mystery_error_rate()': 135,
            },
          ]}
          meta={{
            fields: {
              'mystery_error_rate()': 'rate',
            },
            units: {
              'mystery_error_rate()': '1/second',
            },
          }}
          thresholds={{
            max_values: {
              max1: 200,
              max2: 500,
            },
            unit: '1/second',
          }}
          preferredPolarity="-"
        />
      );

      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'good');
    });
  });
});
