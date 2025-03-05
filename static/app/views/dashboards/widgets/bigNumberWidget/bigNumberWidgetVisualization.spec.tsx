import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {BigNumberWidgetVisualization} from 'sentry/views/dashboards/widgets/bigNumberWidget/bigNumberWidgetVisualization';

import {Widget} from '../widget/widget';

describe('BigNumberWidgetVisualization', () => {
  describe('Visualization', () => {
    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('Explains non-numeric data', () => {
      render(
        <Widget
          Visualization={
            <BigNumberWidgetVisualization
              value={Infinity}
              field="count()"
              meta={{
                fields: {
                  'count()': 'number',
                },
                units: {},
              }}
            />
          }
        />
      );

      expect(screen.getByText('Value is not a finite number.')).toBeInTheDocument();
    });

    it('Formats dates', () => {
      render(
        <BigNumberWidgetVisualization
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
        <BigNumberWidgetVisualization
          value={'/api/0/fetch'}
          field="any(transaction)"
          meta={{
            fields: {
              'max(timestamp)': 'string',
            },
            units: {},
          }}
        />
      );

      expect(screen.getByText('/api/0/fetch')).toBeInTheDocument();
    });

    it('Formats duration data', () => {
      render(
        <BigNumberWidgetVisualization
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
        <BigNumberWidgetVisualization
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
        <BigNumberWidgetVisualization
          value={178451214}
          field="count()"
          maximumValue={100000000}
          meta={{
            fields: {
              'count()': 'integer',
            },
            units: {},
          }}
        />
      );

      expect(screen.getByText(textWithMarkupMatcher('>100m'))).toBeInTheDocument();
    });
  });

  describe('Previous Period Data', () => {
    it('Shows the difference between the current and previous data', () => {
      render(
        <BigNumberWidgetVisualization
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
        <BigNumberWidgetVisualization
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
        <BigNumberWidgetVisualization
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
        <BigNumberWidgetVisualization
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
