import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {sampleDurationTimeSeries} from './fixtures/sampleDurationTimeSeries';
import {sampleThroughputTimeSeries} from './fixtures/sampleThroughputTimeSeries';
import {Line} from './plottables/line';
import {TimeSeriesWidgetVisualization} from './timeSeriesWidgetVisualization';

const plottables = [
  new Line(sampleThroughputTimeSeries),
  new Line(sampleDurationTimeSeries),
];

const releases = [
  {
    version: 'ui@0.1.2',
    timestamp: new Date(sampleThroughputTimeSeries.values[2]!.timestamp).toISOString(),
  },
];

describe('TimeSeriesWidgetVisualization', () => {
  it('lists release lines in the legend', async () => {
    render(
      <TimeSeriesWidgetVisualization
        plottables={plottables}
        releases={releases}
        showReleaseAs="line"
      />
    );

    await userEvent.click(screen.getByRole('button', {name: /more/}));

    expect(screen.getByRole('option', {name: 'Releases'})).toBeInTheDocument();
  });

  it('leaves release bubbles out of the legend', async () => {
    render(
      <TimeSeriesWidgetVisualization
        plottables={plottables}
        releases={releases}
        showReleaseAs="bubble"
      />
    );

    await userEvent.click(screen.getByRole('button', {name: /more/}));

    expect(screen.getByRole('option', {name: 'eps()'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Releases'})).not.toBeInTheDocument();
  });
});
