import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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

      expect(screen.getByText('EPS')).toBeInTheDocument();
      expect(screen.getByText('Number of events per second')).toBeInTheDocument();
      expect(screen.getByText('0.0109/s')).toBeInTheDocument();
    });
  });

  describe('Visualization', () => {
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
  });

  describe('State', () => {
    it('Shows a loading placeholder', () => {
      render(<BigNumberWidget isLoading />);

      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('Shows an error message', () => {
      render(<BigNumberWidget error={new Error('Uh oh')} />);

      expect(screen.getByText('Error: Uh oh')).toBeInTheDocument();
    });
  });
});
