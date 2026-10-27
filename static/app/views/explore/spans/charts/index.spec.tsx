import {useMemo, useState} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import type {OutcomeRow} from 'sentry/components/droppedData/types';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DurationUnit} from 'sentry/utils/discover/fields';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {ChartSelectionProvider} from 'sentry/views/explore/components/attributeBreakdowns/chartSelectionContext';
import * as chartVisualization from 'sentry/views/explore/components/chart/chartVisualization';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {BaseVisualize} from 'sentry/views/explore/queryParams/visualize';
import {
  parseVisualize,
  Visualize,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {ExploreCharts} from 'sentry/views/explore/spans/charts';
import {canShareChart} from 'sentry/views/explore/spans/sharedChartAggregates';
import {defaultVisualizes} from 'sentry/views/explore/spans/spansQueryParams';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import {ChartType} from 'sentry/views/insights/common/components/chart';
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
  it('plots raw and smoothed values in their respective charts', async () => {
    const result = timeseriesResultFixture({
      data: {
        'count(span.duration)': [
          TimeSeriesFixture({
            yAxis: 'count(span.duration)',
            requestedTransformations: [],
            values: [{timestamp: 1729796400000, value: 10}],
          }),
          TimeSeriesFixture({
            yAxis: 'count(span.duration)',
            requestedTransformations: ['smooth(sma,5)'],
            values: [{timestamp: 1729796400000, value: 20}],
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
              new VisualizeFunction('count(span.duration)'),
              new VisualizeFunction('count(span.duration)', {
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
      </SpansQueryParamsProvider>
    );

    const charts = await screen.findAllByLabelText('Chart values');
    expect(charts.map(chart => chart.textContent)).toEqual([
      '[[[1729796400000,10]]]',
      '[[[1729796400000,20]]]',
    ]);
    expect(
      screen.queryByRole('button', {name: 'Add Transformation'})
    ).not.toBeInTheDocument();
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

  describe('chart groups', () => {
    // The series have no values so the charts render their empty state
    // instead of ECharts.
    function timeSeriesFor(yAxis: string): TimeSeries {
      return TimeSeriesFixture({
        yAxis,
        meta: {
          valueType: 'duration',
          valueUnit: DurationUnit.MILLISECOND,
          interval: 1_800_000,
        },
        values: [],
      });
    }

    function ControlledExploreCharts({
      initialVisualizes,
      onSetVisualizes,
    }: {
      initialVisualizes: BaseVisualize[];
      onSetVisualizes?: (visualizes: BaseVisualize[]) => void;
    }) {
      const [serialized, setSerialized] = useState<BaseVisualize[]>(initialVisualizes);
      const visualizes = useMemo(
        () =>
          serialized.flatMap(value => parseVisualize(value, {groupYAxes: canShareChart})),
        [serialized]
      );
      const timeseriesResult = useMemo(
        () =>
          timeseriesResultFixture({
            data: Object.fromEntries(
              visualizes.map(visualize => [
                visualize.yAxis,
                [timeSeriesFor(visualize.yAxis)],
              ])
            ),
          }),
        [visualizes]
      );

      return (
        <SpansQueryParamsProvider>
          <ChartSelectionProvider>
            <ExploreCharts
              extrapolate
              query=""
              timeseriesResult={timeseriesResult}
              visualizes={visualizes}
              setVisualizes={newVisualizes => {
                onSetVisualizes?.(newVisualizes);
                setSerialized(newVisualizes);
              }}
              rawSpanCounts={{
                total: {count: 0, isLoading: false},
                normal: {count: 0, isLoading: false},
              }}
            />
          </ChartSelectionProvider>
        </SpansQueryParamsProvider>
      );
    }

    it('edits transformations for a chart group without changing another chart with the same aggregate', async () => {
      const onSetVisualizes = jest.fn();
      render(
        <ControlledExploreCharts
          initialVisualizes={[
            {yAxes: ['p50(span.duration)', 'p75(span.duration)']},
            {yAxes: ['p50(span.duration)'], transformations: ['fill(locf)']},
            {yAxes: ['equation|$a + $b']},
          ]}
          onSetVisualizes={onSetVisualizes}
        />,
        {
          organization: OrganizationFixture({
            features: ['explore-interpolation-and-smoothing'],
          }),
        }
      );

      const addButtons = await screen.findAllByRole('button', {
        name: 'Add Transformation',
      });
      expect(addButtons).toHaveLength(2);
      await userEvent.click(addButtons[0]!);
      await userEvent.click(screen.getByRole('option', {name: 'Smooth'}));

      expect(onSetVisualizes).toHaveBeenLastCalledWith([
        {
          yAxes: ['p50(span.duration)', 'p75(span.duration)'],
          transformations: ['smooth(sma,3)'],
        },
        {yAxes: ['p50(span.duration)'], transformations: ['fill(locf)']},
        {yAxes: ['equation|$a + $b']},
      ]);

      const rows = screen.getAllByRole('group', {name: 'Transformation 1'});
      expect(rows).toHaveLength(2);
      await userEvent.click(within(rows[0]!).getByRole('button', {name: 'Window Size'}));
      await userEvent.click(screen.getByRole('option', {name: '5'}));
      expect(onSetVisualizes).toHaveBeenLastCalledWith([
        {
          yAxes: ['p50(span.duration)', 'p75(span.duration)'],
          transformations: ['smooth(sma,5)'],
        },
        {yAxes: ['p50(span.duration)'], transformations: ['fill(locf)']},
        {yAxes: ['equation|$a + $b']},
      ]);

      await userEvent.click(screen.getAllByRole('button', {name: 'Collapse chart'})[0]!);
      expect(screen.getAllByRole('button', {name: 'Add Transformation'})).toHaveLength(1);
      expect(screen.getAllByRole('group', {name: 'Transformation 1'})).toHaveLength(1);
      await userEvent.click(screen.getByRole('button', {name: 'Expand chart'}));
      expect(screen.getAllByRole('button', {name: 'Add Transformation'})).toHaveLength(2);
      expect(screen.getAllByRole('group', {name: 'Transformation 1'})).toHaveLength(2);
    });

    it('plots aggregates selected together on a single chart', async () => {
      render(
        <ControlledExploreCharts
          initialVisualizes={[
            {yAxes: ['p50(span.duration)', 'p75(span.duration)', 'p99(span.duration)']},
            {yAxes: ['count(span.duration)']},
          ]}
        />,
        {organization: OrganizationFixture()}
      );

      expect(await screen.findAllByLabelText('Collapse chart')).toHaveLength(2);
      expect(
        screen.getByText('p50(span.duration), p75(span.duration), p99(span.duration)')
      ).toBeInTheDocument();
      expect(screen.queryByLabelText('Combine charts')).not.toBeInTheDocument();
    });

    it('draws each visualization on its own chart when selected separately', async () => {
      render(
        <ControlledExploreCharts
          initialVisualizes={[
            {yAxes: ['p50(span.duration)']},
            {yAxes: ['p75(span.duration)']},
          ]}
        />,
        {organization: OrganizationFixture()}
      );

      expect(await screen.findAllByLabelText('Collapse chart')).toHaveLength(2);
    });

    it('draws charts with several aggregates as line charts', async () => {
      const useChartInfosPlottables = jest.spyOn(
        chartVisualization,
        'useChartInfosPlottables'
      );
      render(
        <ControlledExploreCharts
          initialVisualizes={[
            {
              yAxes: ['p50(span.duration)', 'p99(span.duration)'],
              chartType: ChartType.BAR,
            },
          ]}
        />,
        {organization: OrganizationFixture()}
      );

      expect(await screen.findByLabelText('Collapse chart')).toBeInTheDocument();
      const chartInfos = useChartInfosPlottables.mock.lastCall![0];
      expect(chartInfos.map(info => info.chartType)).toEqual([
        ChartType.LINE,
        ChartType.LINE,
      ]);
      useChartInfosPlottables.mockRestore();
    });

    it('only lets the chart type change for single aggregate charts', async () => {
      render(
        <ControlledExploreCharts
          initialVisualizes={[
            {yAxes: ['p50(span.duration)', 'p99(span.duration)']},
            {yAxes: ['count(span.duration)']},
          ]}
        />,
        {organization: OrganizationFixture()}
      );

      const [combined, single] = await screen.findAllByRole('button', {
        name: 'Chart type',
      });
      expect(combined).toBeDisabled();
      expect(single).toBeEnabled();
    });

    it('keeps the aggregates together when the chart is collapsed', async () => {
      const onSetVisualizes = jest.fn();
      render(
        <ControlledExploreCharts
          initialVisualizes={[{yAxes: ['p50(span.duration)', 'p99(span.duration)']}]}
          onSetVisualizes={onSetVisualizes}
        />,
        {organization: OrganizationFixture()}
      );

      await userEvent.click(await screen.findByLabelText('Collapse chart'));

      expect(onSetVisualizes).toHaveBeenLastCalledWith([
        expect.objectContaining({
          yAxes: ['p50(span.duration)', 'p99(span.duration)'],
          visible: false,
        }),
      ]);
      expect(await screen.findByLabelText('Expand chart')).toBeInTheDocument();
    });
  });

  describe('dropped data layer', () => {
    const features = ['explore-data-fidelity-annotations'];

    beforeEach(() => {
      PageFiltersStore.reset();
      PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
    });

    function renderCharts({
      acceptedEvents = [],
      droppedEvents = [],
      organizationFeatures = features,
      query = '',
    }: {
      acceptedEvents?: OutcomeRow[];
      droppedEvents?: OutcomeRow[];
      organizationFeatures?: string[];
      query?: string;
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
              query={query}
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

    it('notes that dropped spans ignore the search while the layer is on', async () => {
      renderCharts({droppedEvents: [OutcomeRowFixture()], query: 'span.op:db'});

      expect(
        await screen.findByText('Dropped spans are not filtered by search')
      ).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Chart layers'));
      await userEvent.click(screen.getByRole('option', {name: 'Dropped Spans'}));

      expect(
        screen.queryByText('Dropped spans are not filtered by search')
      ).not.toBeInTheDocument();
    });

    it('omits the filter note without a search or environment', async () => {
      renderCharts({droppedEvents: [OutcomeRowFixture()]});

      expect(await screen.findByLabelText('Chart layers')).toBeInTheDocument();
      expect(screen.queryByText(/are not filtered by/)).not.toBeInTheDocument();
    });

    it('hides the Layers control without the feature flag', async () => {
      const request = renderCharts({
        organizationFeatures: [],
        droppedEvents: [OutcomeRowFixture()],
      });

      expect(await screen.findByLabelText('Collapse chart')).toBeInTheDocument();
      expect(request).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Chart layers')).not.toBeInTheDocument();
    });

    it('hides the Layers control when only accepted annotations are present', async () => {
      const request = renderCharts({
        acceptedEvents: [OutcomeRowFixture({outcome: 'accepted', count: 8000})],
      });

      await waitFor(() => expect(request).toHaveBeenCalled());
      await act(async () => {});
      expect(screen.queryByLabelText('Chart layers')).not.toBeInTheDocument();
    });

    it('hides the Layers control when every drop is intentional', async () => {
      const request = renderCharts({
        droppedEvents: [OutcomeRowFixture({tags: ['intentional']})],
      });

      await waitFor(() => expect(request).toHaveBeenCalled());
      await act(async () => {});
      expect(screen.queryByLabelText('Chart layers')).not.toBeInTheDocument();
    });

    it('shows the Layers control when a drop ratio is below 5%', async () => {
      renderCharts({
        droppedEvents: [OutcomeRowFixture({count: 4})],
        acceptedEvents: [OutcomeRowFixture({outcome: 'accepted', count: 96})],
      });

      expect(await screen.findByLabelText('Chart layers')).toBeInTheDocument();
    });

    it('shows the Layers control and toggles the dropped-data layer', async () => {
      renderCharts({droppedEvents: [OutcomeRowFixture()]});

      await userEvent.click(await screen.findByLabelText('Chart layers'));

      const option = await screen.findByRole('option', {name: 'Dropped Spans'});
      expect(option).toHaveAttribute('aria-selected', 'true');

      await userEvent.click(option);
      expect(await screen.findByRole('option', {name: 'Dropped Spans'})).toHaveAttribute(
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
