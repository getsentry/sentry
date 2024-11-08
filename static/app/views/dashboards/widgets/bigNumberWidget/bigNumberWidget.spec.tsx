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
          value={0.01087819860850493}
          field="eps()"
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
          value={undefined}
          field={'p95(span.duration)'}
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
          value={Infinity}
          field="count()"
          meta={{
            fields: {
              'count()': 'number',
            },
          }}
        />
      );

      expect(screen.getByText('Value is not a finite number.')).toBeInTheDocument();
    });

    it('Formats dates', () => {
      render(
        <BigNumberWidget
          value={'2024-10-17T16:08:07+00:00'}
          field="max(timestamp)"
          meta={{
            fields: {
              'max(timestamp)': 'date',
            },
            units: {
              'max(timestamp)': null,
            },
          }}
        />
      );

      expect(screen.getByText('Oct 17, 2024 4:08:07 PM UTC')).toBeInTheDocument();
    });

    it('Renders strings', () => {
      render(
        <BigNumberWidget
          value={'/api/0/fetch'}
          field="any(transaction)"
          meta={{
            fields: {
              'max(timestamp)': 'string',
            },
          }}
        />
      );

      expect(screen.getByText('/api/0/fetch')).toBeInTheDocument();
    });

    it('Formats duration data', () => {
      render(
        <BigNumberWidget
          value={17.28}
          field="p95(span.duration)"
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
          value={178451214}
          field="count()"
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
          value={178451214}
          field="count()"
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
          value={0.14227123}
          previousPeriodValue={0.1728139}
          field="http_response_code_rate(500)"
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
    it('Evaluates the current value against a threshold', async () => {
      render(
        <BigNumberWidget
          value={14.227123}
          field="eps()"
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

      await userEvent.hover(screen.getByRole('status'));
      expect(await screen.findByText('Thresholds in /second')).toBeInTheDocument();
    });

    it('Normalizes the units', () => {
      render(
        <BigNumberWidget
          value={135} //  2.25/s
          field="mystery_error_rate()"
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
          value={135}
          field="mystery_error_rate()"
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
