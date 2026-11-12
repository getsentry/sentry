import {useMemo, useState} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {OutcomeRowFixture} from 'sentry-fixture/outcomeRow';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {OutcomeRow} from 'sentry/components/droppedData/types';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import {DurationUnit} from 'sentry/utils/discover/fields';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {ChartSelectionProvider} from 'sentry/views/explore/components/attributeBreakdowns/chartSelectionContext';
import * as chartVisualization from 'sentry/views/explore/components/chart/chartVisualization';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {BaseVisualize} from 'sentry/views/explore/queryParams/visualize';
import {Visualize, VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {ExploreCharts} from 'sentry/views/explore/spans/charts';
import {canShareChart} from 'sentry/views/explore/spans/sharedChartAggregates';
import {defaultVisualizes} from 'sentry/views/explore/spans/spansQueryParams';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {SortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

jest.mock('echarts-for-react/lib/core', () => {
  return function Chart({
    option,
    onEvents,
  }: {
    onEvents: Record<
      string,
      (event: Record<string, unknown>, instance: Record<string, unknown>) => void
    >;
    option: {
      series: Array<{data?: Array<{value: [number, number]}>}>;
      brush?: unknown;
    };
  }) {
    return (
      <div>
        <output aria-label="Chart values">
          {JSON.stringify(
            option.series.map(series => series.data?.map(point => point.value))
          )}
        </output>
        <button
          onClick={() => {
            const range = [1729796430000, 1729796730000];
            if (option.brush) {
              onEvents.brushend?.(
                {areas: [{coordRange: range, panelId: 'grid--0'}]},
                {
                  getModel: () => ({
                    getComponent: () => ({
                      axis: {scale: {getExtent: () => [1729796400000, 1729797000000]}},
                    }),
                  }),
                  convertToPixel: () => 100,
                  getDom: () => document.body,
                }
              );
            } else {
              onEvents.datazoom?.(
                {batch: [{startValue: range[0], endValue: range[1]}]},
                {}
              );
            }
          }}
        >
          Select chart range
        </button>
      </div>
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
  describe('range selection', () => {
    const timeseriesResult = timeseriesResultFixture({
      data: {
        'count(span.duration)': [
          TimeSeriesFixture({
            yAxis: 'count(span.duration)',
            values: [{timestamp: 1729796400000, value: 10}],
          }),
        ],
      },
    });

    function SelectableChart({
      resultForRange,
    }: {
      resultForRange?: (datetime: PageFilters['datetime']) => SortedTimeSeries;
    }) {
      const {selection} = usePageFilters();
      return (
        <SpansQueryParamsProvider>
          <ChartSelectionProvider>
            <ExploreCharts
              extrapolate
              query=""
              timeseriesResult={resultForRange?.(selection.datetime) ?? timeseriesResult}
              visualizes={defaultVisualizes()}
              setVisualizes={() => {}}
              rawSpanCounts={{
                total: {count: 100, isLoading: false},
                normal: {count: 100, isLoading: false},
              }}
            />
          </ChartSelectionProvider>
        </SpansQueryParamsProvider>
      );
    }

    beforeEach(() => {
      PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
    });

    afterEach(() => {
      PageFiltersStore.reset();
    });

    it.each<Record<string, string>>([
      {mode: 'samples'},
      {mode: 'samples', table: 'trace'},
      {mode: 'aggregate'},
      {mode: 'aggregate', table: 'attribute_breakdowns'},
    ])('zooms directly for %j', async query => {
      const {router} = render(<SelectableChart />, {
        initialRouterConfig: {
          location: {pathname: '/organizations/org-slug/explore/traces/', query},
        },
      });

      await userEvent.click(
        await screen.findByRole('button', {name: 'Select chart range'})
      );

      expect(router.location.query).toEqual(
        expect.objectContaining({
          start: '2024-10-24T19:00:00',
          end: '2024-10-24T19:06:00',
        })
      );
      expect(screen.queryByText('Compare Attribute Breakdowns')).not.toBeInTheDocument();
    });

    it('shows a loading state after zooming until the zoomed data arrives', async () => {
      const pendingResult = timeseriesResultFixture({isPending: true, isLoading: true});
      const zoomedResult = timeseriesResultFixture({
        data: {
          'count(span.duration)': [
            TimeSeriesFixture({
              yAxis: 'count(span.duration)',
              values: [{timestamp: 1729796460000, value: 5}],
            }),
          ],
        },
      });
      const {rerender} = render(
        <SelectableChart
          resultForRange={datetime => (datetime.start ? pendingResult : timeseriesResult)}
        />,
        {
          initialRouterConfig: {
            location: {pathname: '/organizations/org-slug/explore/traces/'},
          },
        }
      );

      const unzoomedChart = await screen.findByLabelText('Chart values');
      await userEvent.click(screen.getByRole('button', {name: 'Select chart range'}));

      expect(await screen.findByTestId('loading-indicator')).toBeInTheDocument();
      expect(unzoomedChart).not.toBeInTheDocument();

      rerender(
        <SelectableChart
          resultForRange={datetime => (datetime.start ? zoomedResult : timeseriesResult)}
        />
      );

      expect(await screen.findByLabelText('Chart values')).toHaveTextContent(
        '[[[1729796460000,5]]]'
      );
    });

    it('shows a loading state when the date selection changes', async () => {
      PageFiltersStore.onInitializeUrlState(
        PageFiltersFixture({
          datetime: {
            start: '2024-10-24T19:00:00',
            end: '2024-10-24T19:06:00',
            period: null,
            utc: null,
          },
        })
      );
      const pendingResult = timeseriesResultFixture({isPending: true, isLoading: true});
      render(
        <SelectableChart
          resultForRange={datetime =>
            datetime.period === '30d' ? pendingResult : timeseriesResult
          }
        />,
        {
          initialRouterConfig: {
            location: {pathname: '/organizations/org-slug/explore/traces/'},
          },
        }
      );

      const zoomedChart = await screen.findByLabelText('Chart values');

      act(() => {
        PageFiltersStore.updateDateTime({
          period: '30d',
          start: null,
          end: null,
          utc: null,
        });
      });

      expect(await screen.findByTestId('loading-indicator')).toBeInTheDocument();
      expect(zoomedChart).not.toBeInTheDocument();
    });

    it('opens the breakdown menu and restores direct zoom when leaving the tab', async () => {
      const {router} = render(<SelectableChart />, {
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {mode: 'samples', table: 'attribute_breakdowns'},
          },
        },
      });

      await userEvent.click(
        await screen.findByRole('button', {name: 'Select chart range'})
      );

      expect(await screen.findByText('Compare Attribute Breakdowns')).toBeInTheDocument();
      expect(screen.getByText('Zoom in')).toBeInTheDocument();
      expect(router.location.query.start).toBeUndefined();
      const breakdownChart = screen.getByLabelText('Chart values');

      act(() => {
        router.navigate(
          '/organizations/org-slug/explore/traces/?mode=samples&table=trace'
        );
      });

      expect(screen.queryByText('Compare Attribute Breakdowns')).not.toBeInTheDocument();
      expect(breakdownChart).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Select chart range'}));

      expect(router.location.query).toEqual(
        expect.objectContaining({
          start: '2024-10-24T19:00:00',
          end: '2024-10-24T19:06:00',
        })
      );
    });
  });

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
          serialized.flatMap(value =>
            Visualize.fromJSON(value, {groupYAxes: canShareChart})
          ),
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
      expect(addButtons).toHaveLength(3);
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
      expect(screen.getAllByRole('button', {name: 'Add Transformation'})).toHaveLength(2);
      expect(screen.getAllByRole('group', {name: 'Transformation 1'})).toHaveLength(1);
      await userEvent.click(screen.getByRole('button', {name: 'Expand chart'}));
      expect(screen.getAllByRole('button', {name: 'Add Transformation'})).toHaveLength(3);
      expect(screen.getAllByRole('group', {name: 'Transformation 1'})).toHaveLength(2);
    });

    it('adds a transformation to an equation chart', async () => {
      const onSetVisualizes = jest.fn();
      render(
        <ControlledExploreCharts
          initialVisualizes={[
            {yAxes: ['p50(span.duration)']},
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
      await userEvent.click(addButtons[1]!);
      await userEvent.click(screen.getByRole('option', {name: 'Smooth'}));

      expect(onSetVisualizes).toHaveBeenLastCalledWith([
        {yAxes: ['p50(span.duration)']},
        {yAxes: ['equation|$a + $b'], transformations: ['smooth(sma,3)']},
      ]);
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

    it('hides the heatmap chart type without explore-dev-features', async () => {
      render(
        <ControlledExploreCharts
          initialVisualizes={[{yAxes: ['count(span.duration)']}]}
        />,
        {
          organization: OrganizationFixture(),
        }
      );

      await userEvent.click(await screen.findByRole('button', {name: 'Chart type'}));
      expect(screen.getByRole('option', {name: 'Line'})).toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'Heatmap'})).not.toBeInTheDocument();
    });

    it('defaults count to a heatmap', async () => {
      render(
        <ControlledExploreCharts
          initialVisualizes={[{yAxes: ['count(span.duration)']}]}
        />,
        {organization: OrganizationFixture({features: ['explore-dev-features']})}
      );

      await userEvent.click(await screen.findByRole('button', {name: 'Chart type'}));
      expect(screen.getByRole('option', {name: 'Heatmap'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    it('switches count back to a heatmap', async () => {
      const onSetVisualizes = jest.fn();
      render(
        <ControlledExploreCharts
          initialVisualizes={[
            {yAxes: ['count(span.duration)'], chartType: ChartType.BAR},
          ]}
          onSetVisualizes={onSetVisualizes}
        />,
        {organization: OrganizationFixture({features: ['explore-dev-features']})}
      );

      await userEvent.click(await screen.findByRole('button', {name: 'Chart type'}));
      await userEvent.click(screen.getByRole('option', {name: 'Heatmap'}));

      expect(onSetVisualizes).toHaveBeenLastCalledWith([
        {yAxes: ['count(span.duration)'], chartType: ChartType.HEATMAP},
      ]);
    });

    it('disables the heatmap chart type for percentiles', async () => {
      render(
        <ControlledExploreCharts initialVisualizes={[{yAxes: ['p75(span.duration)']}]} />,
        {
          organization: OrganizationFixture({features: ['explore-dev-features']}),
        }
      );

      await userEvent.click(await screen.findByRole('button', {name: 'Chart type'}));
      expect(screen.getByRole('option', {name: 'Heatmap'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    it('draws unsupported heatmaps as line charts', async () => {
      const useChartInfosPlottables = jest.spyOn(
        chartVisualization,
        'useChartInfosPlottables'
      );
      render(
        <ControlledExploreCharts
          initialVisualizes={[
            {yAxes: ['p75(span.duration)'], chartType: ChartType.HEATMAP},
          ]}
        />,
        {organization: OrganizationFixture({features: ['explore-dev-features']})}
      );

      expect(await screen.findByLabelText('Collapse chart')).toBeInTheDocument();
      const chartInfos = useChartInfosPlottables.mock.lastCall![0];
      expect(chartInfos.map(info => info.chartType)).toEqual([ChartType.LINE]);
      useChartInfosPlottables.mockRestore();
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
      PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
    });

    afterEach(() => {
      PageFiltersStore.reset();
    });

    function renderCharts({
      acceptedEvents = [],
      asyncDelay,
      droppedEvents = [],
      organizationFeatures = features,
      query = '',
      timeseriesResult = timeseriesResultFixture(),
    }: {
      acceptedEvents?: OutcomeRow[];
      asyncDelay?: Promise<void>;
      droppedEvents?: OutcomeRow[];
      organizationFeatures?: string[];
      query?: string;
      timeseriesResult?: SortedTimeSeries;
    }) {
      const request = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-dropped/',
        body: {
          meta: {dataset: 'spans', start: 0, end: 0, interval: 0},
          droppedEvents,
          acceptedEvents,
        },
        asyncDelay,
      });

      render(
        <SpansQueryParamsProvider>
          <ChartSelectionProvider>
            <ExploreCharts
              extrapolate
              query={query}
              timeseriesResult={timeseriesResult}
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

    it('waits for the dropped data before drawing the chart', async () => {
      let resolveDroppedData!: () => void;
      const asyncDelay = new Promise<void>(resolve => {
        resolveDroppedData = resolve;
      });
      renderCharts({
        asyncDelay,
        droppedEvents: [OutcomeRowFixture()],
        timeseriesResult: timeseriesResultFixture({
          data: {
            'count(span.duration)': [
              TimeSeriesFixture({
                yAxis: 'count(span.duration)',
                values: [{timestamp: 1729796400000, value: 10}],
              }),
            ],
          },
        }),
      });

      expect(await screen.findByTestId('loading-indicator')).toBeInTheDocument();
      expect(screen.queryByLabelText('Chart values')).not.toBeInTheDocument();

      await act(async () => {
        resolveDroppedData();
        await asyncDelay;
      });

      expect(await screen.findByLabelText('Chart values')).toHaveTextContent(
        '[[[1729796400000,10]],[[0,0]]]'
      );
    });

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

    it('disables the dropped-data layer when only accepted annotations are present', async () => {
      renderCharts({
        acceptedEvents: [OutcomeRowFixture({outcome: 'accepted', count: 8000})],
      });

      await userEvent.click(await screen.findByLabelText('Chart layers'));

      const option = screen.getByRole('option', {name: 'Dropped Spans'});
      expect(option).toHaveAttribute('aria-disabled', 'true');

      await userEvent.hover(within(option).getByText('Dropped Spans'));
      expect(
        await screen.findByText('No significant dropped spans in this time range')
      ).toBeInTheDocument();
    });

    it('disables the dropped-data layer when every drop is intentional', async () => {
      renderCharts({
        droppedEvents: [OutcomeRowFixture({tags: ['intentional']})],
        query: 'span.op:db',
      });

      await userEvent.click(await screen.findByLabelText('Chart layers'));

      expect(screen.getByRole('option', {name: 'Dropped Spans'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      expect(screen.queryByText(/are not filtered by/)).not.toBeInTheDocument();
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
