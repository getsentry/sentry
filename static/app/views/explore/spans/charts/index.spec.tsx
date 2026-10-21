import {useMemo, useState} from 'react';
import {DroppedEventFixture} from 'sentry-fixture/droppedEvent';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {DroppedEventsBucket} from 'sentry/components/droppedData/types';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ChartSelectionProvider} from 'sentry/views/explore/components/attributeBreakdowns/chartSelectionContext';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {BaseVisualize} from 'sentry/views/explore/queryParams/visualize';
import {Visualize, VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {ExploreCharts} from 'sentry/views/explore/spans/charts';
import {defaultVisualizes} from 'sentry/views/explore/spans/spansQueryParams';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import type {SortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

jest.mock('echarts-for-react/lib/core', () => {
  return function Chart({
    option,
  }: {
    option: {series: Array<{data?: Array<[number, number]>}>};
  }) {
    return (
      <output aria-label="Chart values">
        {JSON.stringify(option.series.map(series => series.data))}
      </output>
    );
  };
});

function timeseriesResultFixture(overrides: Partial<SortedTimeSeries> = {}) {
  const base: Partial<SortedTimeSeries> = {
    data: {},
    isLoading: false,
    isPending: false,
    isFetching: false,
  };
  return {...base, ...overrides} as SortedTimeSeries;
}

describe('ExploreCharts', () => {
  it('plots each pipeline separately and uses the raw count for missing confidence', async () => {
    const result = timeseriesResultFixture({
      data: {
        'avg(span.duration)': [
          TimeSeriesFixture({
            yAxis: 'avg(span.duration)',
            requestedTransformations: ['fill(locf)'],
            meta: {valueType: 'number', valueUnit: null, interval: 1_800_000},
            values: [{timestamp: 1729796400000, value: 11}],
          }),
          TimeSeriesFixture({
            yAxis: 'avg(span.duration)',
            requestedTransformations: ['smooth(sma,5)'],
            meta: {valueType: 'number', valueUnit: null, interval: 1_800_000},
            values: [
              {timestamp: 1729796400000, value: 29, sampleCount: 3, sampleRate: 1},
            ],
          }),
        ],
        'count(span.duration)': [
          TimeSeriesFixture({
            yAxis: 'count(span.duration)',
            requestedTransformations: ['fill(locf)'],
            values: [
              {timestamp: 1729796400000, value: 93, sampleCount: 93, sampleRate: 1},
            ],
          }),
          TimeSeriesFixture({
            yAxis: 'count(span.duration)',
            requestedTransformations: [],
            values: [{timestamp: 1729796400000, value: 7, sampleCount: 7, sampleRate: 1}],
          }),
        ],
      },
    });

    render(
      <SpansQueryParamsProvider>
        <ChartSelectionProvider>
          <ExploreCharts
            extrapolate
            query=""
            timeseriesResult={result}
            visualizes={[
              new VisualizeFunction('avg(span.duration)', {
                transformations: ['fill(locf)'],
              }),
              new VisualizeFunction('avg(span.duration)', {
                transformations: ['smooth(sma,5)'],
              }),
            ]}
            setVisualizes={() => {}}
            rawSpanCounts={{
              total: {count: 100, isLoading: false},
              normal: {count: 100, isLoading: false},
            }}
          />
        </ChartSelectionProvider>
      </SpansQueryParamsProvider>,
      {organization: OrganizationFixture()}
    );

    const charts = await screen.findAllByLabelText('Chart values');
    expect(charts.map(chart => chart.textContent)).toEqual([
      '[[[1729796400000,11]]]',
      '[[[1729796400000,29]]]',
    ]);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.queryByText('93')).not.toBeInTheDocument();
  });

  it('renders the high accuracy message when the widget is loading more data', async () => {
    const loadingTimeseriesResult = timeseriesResultFixture({
      isLoading: true,
      isPending: true,
      isFetching: true,
    });

    render(
      <SpansQueryParamsProvider>
        <ChartSelectionProvider>
          <ExploreCharts
            extrapolate
            query=""
            timeseriesResult={loadingTimeseriesResult}
            visualizes={defaultVisualizes()}
            setVisualizes={() => {}}
            samplingMode={SAMPLING_MODE.HIGH_ACCURACY}
            rawSpanCounts={{
              total: {count: 0, isLoading: true},
              normal: {count: 0, isLoading: true},
            }}
          />
        </ChartSelectionProvider>
      </SpansQueryParamsProvider>,
      {
        organization: OrganizationFixture(),
      }
    );

    expect(
      await screen.findByText(
        "Hey, we're scanning all the data we can to answer your query, so please wait a bit longer"
      )
    ).toBeInTheDocument();
  });

  describe('expand/collapse', () => {
    function ControlledExploreCharts() {
      const [serialized, setSerialized] = useState<BaseVisualize[]>(() =>
        defaultVisualizes().map(visualize => visualize.serialize())
      );
      const visualizes = useMemo(
        () => serialized.flatMap(value => Visualize.fromJSON(value)),
        [serialized]
      );

      return (
        <SpansQueryParamsProvider>
          <ChartSelectionProvider>
            <ExploreCharts
              extrapolate
              query=""
              timeseriesResult={timeseriesResultFixture()}
              visualizes={visualizes}
              setVisualizes={setSerialized}
              rawSpanCounts={{
                total: {count: 0, isLoading: false},
                normal: {count: 0, isLoading: false},
              }}
            />
          </ChartSelectionProvider>
        </SpansQueryParamsProvider>
      );
    }

    it('shows the collapse control when a chart is visible by default', async () => {
      render(<ControlledExploreCharts />, {organization: OrganizationFixture()});

      expect(await screen.findByLabelText('Collapse chart')).toBeInTheDocument();
      expect(screen.queryByLabelText('Expand chart')).not.toBeInTheDocument();
    });

    it('collapses and expands the chart when the dedicated controls are clicked', async () => {
      render(<ControlledExploreCharts />, {organization: OrganizationFixture()});

      await userEvent.click(await screen.findByLabelText('Collapse chart'));

      expect(await screen.findByLabelText('Expand chart')).toBeInTheDocument();
      expect(screen.queryByLabelText('Collapse chart')).not.toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Expand chart'));

      expect(await screen.findByLabelText('Collapse chart')).toBeInTheDocument();
      expect(screen.queryByLabelText('Expand chart')).not.toBeInTheDocument();
    });
  });

  describe('dropped data layer', () => {
    const features = ['explore-data-fidelity-annotations'];

    beforeEach(() => {
      PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
    });

    afterEach(() => {
      PageFiltersStore.reset();
    });

    function renderCharts({
      acceptedEvents = [],
      droppedEvents = [],
      organizationFeatures = features,
    }: {
      acceptedEvents?: DroppedEventsBucket[];
      droppedEvents?: DroppedEventsBucket[];
      organizationFeatures?: string[];
    }) {
      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-dropped/',
        body: {
          meta: {dataset: 'spans', start: 0, end: 0, interval: 0},
          droppedEvents,
          acceptedEvents,
        },
      });

      render(
        <SpansQueryParamsProvider>
          <ChartSelectionProvider>
            <ExploreCharts
              extrapolate
              query=""
              timeseriesResult={timeseriesResultFixture()}
              visualizes={defaultVisualizes()}
              setVisualizes={() => {}}
              rawSpanCounts={{
                total: {count: 0, isLoading: false},
                normal: {count: 0, isLoading: false},
              }}
            />
          </ChartSelectionProvider>
        </SpansQueryParamsProvider>,
        {organization: OrganizationFixture({features: organizationFeatures})}
      );

      return request;
    }

    it('hides the Layers control without the feature flag', async () => {
      const request = renderCharts({
        organizationFeatures: [],
        droppedEvents: [DroppedEventFixture()],
      });

      expect(await screen.findByLabelText('Collapse chart')).toBeInTheDocument();
      expect(request).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Chart layers')).not.toBeInTheDocument();
    });

    it('hides the Layers control when only accepted annotations are present', async () => {
      const request = renderCharts({
        acceptedEvents: [DroppedEventFixture({outcome: 'accepted', count: 8000})],
      });

      await waitFor(() => expect(request).toHaveBeenCalled());
      await act(async () => {});
      expect(screen.queryByLabelText('Chart layers')).not.toBeInTheDocument();
    });

    it('hides the Layers control when every drop is intentional', async () => {
      const request = renderCharts({
        droppedEvents: [DroppedEventFixture({tags: ['intentional']})],
      });

      await waitFor(() => expect(request).toHaveBeenCalled());
      await act(async () => {});
      expect(screen.queryByLabelText('Chart layers')).not.toBeInTheDocument();
    });

    it('shows the Layers control when a drop ratio is below 5%', async () => {
      renderCharts({
        droppedEvents: [DroppedEventFixture({count: 4})],
        acceptedEvents: [DroppedEventFixture({outcome: 'accepted', count: 96})],
      });

      expect(await screen.findByLabelText('Chart layers')).toBeInTheDocument();
    });

    it('shows the Layers control and toggles the dropped-data layer', async () => {
      renderCharts({droppedEvents: [DroppedEventFixture()]});

      await userEvent.click(await screen.findByLabelText('Chart layers'));

      const option = await screen.findByRole('option', {name: 'Dropped Events'});
      expect(option).toHaveAttribute('aria-selected', 'true');

      await userEvent.click(option);
      expect(await screen.findByRole('option', {name: 'Dropped Events'})).toHaveAttribute(
        'aria-selected',
        'false'
      );
    });
  });

  it('shows an error when the series conditional filter is invalid', async () => {
    const visualize = Visualize.fromJSON({
      yAxes: ['count_if(`p95(span.duration):>100`,span.duration)'],
    })[0]!;

    render(
      <SpansQueryParamsProvider>
        <ChartSelectionProvider>
          <ExploreCharts
            extrapolate
            query=""
            timeseriesResult={timeseriesResultFixture()}
            visualizes={[visualize]}
            setVisualizes={() => {}}
            rawSpanCounts={{
              total: {count: 0, isLoading: false},
              normal: {count: 0, isLoading: false},
            }}
          />
        </ChartSelectionProvider>
      </SpansQueryParamsProvider>,
      {organization: OrganizationFixture()}
    );

    expect(
      await screen.findByText('Aggregates cannot be used in conditional filters')
    ).toBeInTheDocument();
  });
});
