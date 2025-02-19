import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {TimeSeriesItem} from '../common/types';

import {sampleDurationTimeSeries} from './fixtures/sampleDurationTimeSeries';
import {LineChartWidget} from './lineChartWidget';

describe('LineChartWidget', () => {
  describe('Layout', () => {
    it('Renders', () => {
      render(
        <LineChartWidget
          title="eps()"
          description="Number of events per second"
          timeSeries={[sampleDurationTimeSeries]}
        />
      );
    });
  });

  describe('Visualization', () => {
    it('Explains missing data', () => {
      jest.spyOn(console, 'error').mockImplementation();
      render(<LineChartWidget />);

      expect(screen.getByText('No Data')).toBeInTheDocument();
      jest.resetAllMocks();
    });

    const UNPLOTTABLE_CASES = [
      [[]],
      [
        [
          {
            timestamp: '2025-01-01T00:00:00',
            value: null,
          },
        ],
      ],
      [
        [
          {
            timestamp: '2025-01-01T00:00:00',
            value: null,
          },
          {
            timestamp: '2025-01-01T00:01:00',
            value: null,
          },
        ],
      ],
    ] satisfies Array<[TimeSeriesItem[]]>;

    it.each(UNPLOTTABLE_CASES)('Explains no plottable values for %s', data => {
      jest.spyOn(console, 'error').mockImplementation();
      render(
        <LineChartWidget
          timeSeries={[
            {
              field: 'count()',
              data,
              meta: {
                fields: {
                  'count()': 'number',
                },
                units: {},
              },
            },
          ]}
        />
      );

      expect(
        screen.getByText(/does not contain any plottable values/)
      ).toBeInTheDocument();
      jest.resetAllMocks();
    });
  });

  describe('State', () => {
    it('Shows a loading placeholder', () => {
      render(<LineChartWidget isLoading />);

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    });

    it('Loading state takes precedence over error state', () => {
      render(
        <LineChartWidget isLoading error={new Error('Parsing error of old value')} />
      );

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    });

    it('Shows an error message', () => {
      render(<LineChartWidget error={new Error('Uh oh')} />);

      expect(screen.getByText('Error: Uh oh')).toBeInTheDocument();
    });

    it('Shows a retry button', async () => {
      const onRetry = jest.fn();

      render(<LineChartWidget error={new Error('Oh no!')} onRetry={onRetry} />);

      await userEvent.click(screen.getByRole('button', {name: 'Retry'}));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('Hides other actions if there is an error and a retry handler', () => {
      const onRetry = jest.fn();

      render(
        <LineChartWidget
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
});
