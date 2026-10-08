import {useMemo, useState} from 'react';
import {DroppedEventFixture} from 'sentry-fixture/droppedEvent';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {DroppedEventsBucket} from 'sentry/components/droppedData/types';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DurationUnit} from 'sentry/utils/discover/fields';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {ChartSelectionProvider} from 'sentry/views/explore/components/attributeBreakdowns/chartSelectionContext';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {BaseVisualize} from 'sentry/views/explore/queryParams/visualize';
import {Visualize} from 'sentry/views/explore/queryParams/visualize';
import {ExploreCharts} from 'sentry/views/explore/spans/charts';
import {defaultVisualizes} from 'sentry/views/explore/spans/spansQueryParams';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';
import type {SortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

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

  describe('combine charts', () => {
    // Only the meta matters for deciding whether charts can be combined. The
    // series have no values so the charts render their empty state instead
    // of ECharts.
    function timeSeriesFor(yAxis: string): TimeSeries {
      if (yAxis === 'eps()') {
        return TimeSeriesFixture({yAxis, values: []});
      }
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

    function ControlledExploreCharts({yAxes}: {yAxes: string[]}) {
      const timeseriesResult = useMemo(
        () =>
          timeseriesResultFixture({
            data: Object.fromEntries(yAxes.map(yAxis => [yAxis, [timeSeriesFor(yAxis)]])),
          }),
        [yAxes]
      );
      const [serialized, setSerialized] = useState<BaseVisualize[]>(() =>
        yAxes.map(yAxis => ({yAxes: [yAxis]}))
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
              timeseriesResult={timeseriesResult}
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

    it('does not offer to combine a single chart', async () => {
      render(<ControlledExploreCharts yAxes={['p50(span.duration)']} />, {
        organization: OrganizationFixture(),
      });

      expect(await screen.findByLabelText('Collapse chart')).toBeInTheDocument();
      expect(screen.queryByLabelText('Combine charts')).not.toBeInTheDocument();
    });

    it('plots every visualization on a single chart when combined', async () => {
      const onNuqsUrlUpdate = jest.fn();
      render(
        <ControlledExploreCharts
          yAxes={['p50(span.duration)', 'p75(span.duration)', 'p99(span.duration)']}
        />,
        {organization: OrganizationFixture(), onNuqsUrlUpdate}
      );

      expect(await screen.findAllByLabelText('Combine charts')).toHaveLength(3);
      expect(screen.getAllByLabelText('Collapse chart')).toHaveLength(3);

      await userEvent.click(screen.getAllByLabelText('Combine charts')[0]!);

      expect(await screen.findByLabelText('Split charts')).toBeInTheDocument();
      expect(screen.getAllByLabelText('Collapse chart')).toHaveLength(1);
      expect(
        screen.getByText('p50(span.duration), p75(span.duration), p99(span.duration)')
      ).toBeInTheDocument();
      expect(onNuqsUrlUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          queryString: expect.stringContaining('combineCharts=true'),
        })
      );

      await userEvent.click(screen.getByLabelText('Split charts'));

      expect(await screen.findAllByLabelText('Combine charts')).toHaveLength(3);
      expect(screen.getAllByLabelText('Collapse chart')).toHaveLength(3);
    });

    it('does not combine visualizations with different units', async () => {
      render(<ControlledExploreCharts yAxes={['p50(span.duration)', 'eps()']} />, {
        organization: OrganizationFixture(),
        initialRouterConfig: {location: {pathname: '/', query: {combineCharts: 'true'}}},
      });

      const combineButtons = await screen.findAllByLabelText('Combine charts');
      expect(combineButtons).toHaveLength(2);
      for (const button of combineButtons) {
        expect(button).toHaveAttribute('aria-disabled', 'true');
      }
      expect(screen.getAllByLabelText('Collapse chart')).toHaveLength(2);
      expect(screen.queryByLabelText('Split charts')).not.toBeInTheDocument();

      await userEvent.hover(combineButtons[0]!);
      expect(
        await screen.findByText('Only visualizations with the same unit can be combined')
      ).toBeInTheDocument();
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

    it('hides the Layers control when every drop is configured', async () => {
      const request = renderCharts({
        droppedEvents: [
          DroppedEventFixture({outcome: 'client_discard', reason: 'sample_rate'}),
        ],
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

      const option = await screen.findByRole('option', {name: 'Dropped Data'});
      expect(option).toHaveAttribute('aria-selected', 'true');

      await userEvent.click(option);
      expect(await screen.findByRole('option', {name: 'Dropped Data'})).toHaveAttribute(
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
