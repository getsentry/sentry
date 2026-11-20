import type {CallbackDataParams} from 'echarts/types/dist/shared';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {AnnotationItem} from 'sentry/components/charts/annotations/types';
import {BAND_Z} from 'sentry/components/charts/bands/bandShapes';
import {ANNOTATION_BAND_SERIES_ID} from 'sentry/components/charts/bands/useAnnotationBand';
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

const annotations: AnnotationItem[] = [
  {
    id: 'release:ui@0.1.2',
    kind: 'release',
    start: sampleThroughputTimeSeries.values[2]!.timestamp,
    title: 'ui@0.1.2',
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

  it('draws annotations as a band aligned to the chart buckets', () => {
    render(
      <TimeSeriesWidgetVisualization plottables={plottables} annotations={annotations} />
    );

    const {series} = jest.mocked(BaseChart).mock.calls.at(-1)![0];
    const annotationBand = series?.find(({id}) => id === ANNOTATION_BAND_SERIES_ID);

    expect(annotationBand?.data).toEqual(
      sampleThroughputTimeSeries.values.map(({timestamp}, index) =>
        expect.objectContaining({
          start: timestamp,
          items: index === 2 ? annotations : [],
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
        annotations={annotations}
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
        expect.objectContaining({id: ANNOTATION_BAND_SERIES_ID, z: BAND_Z}),
      ])
    );
  });

  it('shows the same tooltip on the annotation and dropped data bands for a bucket', async () => {
    const {timestamp: start} = sampleThroughputTimeSeries.values[2]!;
    const end = start + sampleThroughputTimeSeries.meta.interval;

    render(
      <TimeSeriesWidgetVisualization
        plottables={plottables}
        annotations={annotations}
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

    const fromAnnotations = await hoverBand(ANNOTATION_BAND_SERIES_ID, 2);
    const fromDroppedData = await hoverBand(DROPPED_DATA_SERIES_ID, 0);

    expect(fromAnnotations).toBe(fromDroppedData);
    expect(fromAnnotations).toContain('Dropped Spans');
    expect(fromAnnotations).toContain('Releases');
  });

  describe('confidence', () => {
    const lowConfidencePlottables = [
      new Line(
        TimeSeriesFixture({
          values: [
            {timestamp: 1729796400000, value: 10},
            {timestamp: 1729798200000, value: 20, confidence: 'low'},
            {timestamp: 1729800000000, value: 30},
          ],
        })
      ),
    ];

    function plottedLineStyles() {
      const {series} = jest.mocked(BaseChart).mock.calls.at(-1)![0];
      return series?.map(item =>
        'lineStyle' in item ? item.lineStyle?.type : undefined
      );
    }

    it('does not mark low-confidence buckets by default', () => {
      render(<TimeSeriesWidgetVisualization plottables={lowConfidencePlottables} />);

      expect(plottedLineStyles()).not.toContain('dashed');
    });

    it('marks low-confidence buckets with showConfidence', () => {
      render(
        <TimeSeriesWidgetVisualization
          plottables={lowConfidencePlottables}
          showConfidence
        />
      );

      expect(plottedLineStyles()).toContain('dashed');
    });
  });
});
