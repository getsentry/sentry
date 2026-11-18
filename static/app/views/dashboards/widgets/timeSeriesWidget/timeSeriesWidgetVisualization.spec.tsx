import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {RELEASE_BAND_SERIES_ID} from 'sentry/components/charts/bands/useReleaseBand';
import {BaseChart} from 'sentry/components/charts/baseChart';

import {sampleDurationTimeSeries} from './fixtures/sampleDurationTimeSeries';
import {sampleThroughputTimeSeries} from './fixtures/sampleThroughputTimeSeries';
import {Line} from './plottables/line';
import {TimeSeriesWidgetVisualization} from './timeSeriesWidgetVisualization';

jest.mock('sentry/components/charts/baseChart', () => {
  const actual = jest.requireActual('sentry/components/charts/baseChart');
  return {...actual, BaseChart: jest.fn(actual.BaseChart)};
});

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

  it('draws releases as a band aligned to the chart buckets', () => {
    render(
      <TimeSeriesWidgetVisualization
        plottables={plottables}
        releases={releases}
        showReleaseAs="band"
      />
    );

    const {series} = jest.mocked(BaseChart).mock.calls.at(-1)![0];
    const releaseBand = series?.find(({id}) => id === RELEASE_BAND_SERIES_ID);

    expect(releaseBand?.data).toEqual([
      expect.objectContaining({
        start: sampleThroughputTimeSeries.values[2]!.timestamp,
        releases,
      }),
    ]);
    expect(series?.find(({name}) => name === 'Releases')).toBeUndefined();
  });
});
