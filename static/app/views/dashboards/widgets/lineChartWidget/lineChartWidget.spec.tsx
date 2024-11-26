import {render} from 'sentry-test/reactTestingLibrary';

import {LineChartWidget} from './lineChartWidget';

describe('LineChartWidget', () => {
  describe('Layout', () => {
    it('Renders', () => {
      render(
        <LineChartWidget
          title="eps()"
          description="Number of events per second"
          timeseries={[]}
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
    });
  });
});
