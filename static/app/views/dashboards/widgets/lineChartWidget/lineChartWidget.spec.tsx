import {render} from 'sentry-test/reactTestingLibrary';

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
