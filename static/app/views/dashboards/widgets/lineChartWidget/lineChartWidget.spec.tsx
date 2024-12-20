import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {LineChartWidget} from './lineChartWidget';
import sampleDurationTimeSeries from './sampleDurationTimeSeries.json';

describe('LineChartWidget', () => {
  describe('Layout', () => {
    it('Renders', () => {
      render(
        <LineChartWidget
          title="eps()"
          description="Number of events per second"
          timeseries={[sampleDurationTimeSeries]}
        />
      );
    });
  });

  describe('Visualization', () => {
    it('Explains missing data', () => {
      render(<LineChartWidget />);

      expect(screen.getByText('No Data')).toBeInTheDocument();
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
