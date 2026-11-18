import type {CallbackDataParams} from 'echarts/types/dist/shared';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {BAND_Z} from 'sentry/components/charts/bands/bandShapes';
import {RELEASE_BAND_SERIES_ID} from 'sentry/components/charts/bands/useReleaseBand';
import {BaseChart} from 'sentry/components/charts/baseChart';
import {DROPPED_DATA_SERIES_ID} from 'sentry/components/droppedData/band/useDroppedDataBand';
import {DiscoverDatasets} from 'sentry/utils/discover/types';

import {sampleDurationTimeSeries} from './fixtures/sampleDurationTimeSeries';
import {sampleThroughputTimeSeries} from './fixtures/sampleThroughputTimeSeries';
import {Line} from './plottables/line';
import {TimeSeriesWidgetVisualization} from './timeSeriesWidgetVisualization';

jest.mock('sentry/components/charts/baseChart', () => {
  const actual = jest.requireActual('sentry/components/charts/baseChart');
  return {...actual, BaseChart: jest.fn(actual.BaseChart)};
});

jest.mock('sentry/components/charts/utils', () => ({
  ...jest.requireActual('sentry/components/charts/utils'),
  isChartHovered: () => true,
}));

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

    expect(releaseBand?.data).toEqual(
      sampleThroughputTimeSeries.values.map(({timestamp}, index) =>
        expect.objectContaining({
          start: timestamp,
          releases: index === 2 ? releases : [],
        })
      )
    );
    expect(series?.find(({name}) => name === 'Releases')).toBeUndefined();
  });

  it('draws the bands above the plotted series so their highlight covers them', () => {
    const {timestamp: start} = sampleThroughputTimeSeries.values[2]!;

    render(
      <TimeSeriesWidgetVisualization
        plottables={plottables}
        releases={releases}
        showReleaseAs="band"
        droppedData={{
          dataset: DiscoverDatasets.SPANS,
          droppedEvents: [OutcomeRowFixture({start, count: 10})],
        }}
      />
    );

    const {series} = jest.mocked(BaseChart).mock.calls.at(-1)![0];

    expect(series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({id: DROPPED_DATA_SERIES_ID, z: BAND_Z}),
        expect.objectContaining({id: RELEASE_BAND_SERIES_ID, z: BAND_Z}),
      ])
    );
  });

  it('shows the same tooltip on the release and dropped data bands for a bucket', async () => {
    const {timestamp: start} = sampleThroughputTimeSeries.values[2]!;
    const end = start + sampleThroughputTimeSeries.meta.interval;

    render(
      <TimeSeriesWidgetVisualization
        plottables={plottables}
        releases={releases}
        showReleaseAs="band"
        droppedData={{
          dataset: DiscoverDatasets.SPANS,
          droppedEvents: [OutcomeRowFixture({start, end, count: 10})],
        }}
      />
    );

    const {series} = jest.mocked(BaseChart).mock.calls.at(-1)![0];
    function hoverBand(id: string, dataIndex: number) {
      const formatter = series?.find(item => item.id === id)?.tooltip?.formatter as (
        params: CallbackDataParams
      ) => string;
      return act(() => formatter({dataIndex} as CallbackDataParams));
    }

    const fromReleases = await hoverBand(RELEASE_BAND_SERIES_ID, 2);
    const fromDroppedData = await hoverBand(DROPPED_DATA_SERIES_ID, 0);

    expect(fromReleases).toBe(fromDroppedData);
    expect(fromReleases).toContain('Dropped Spans');
    expect(fromReleases).toContain('Releases');
  });
});
