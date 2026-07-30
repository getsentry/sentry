import {useMemo, useState} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ChartSelectionProvider} from 'sentry/views/explore/components/attributeBreakdowns/chartSelectionContext';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {BaseVisualize} from 'sentry/views/explore/queryParams/visualize';
import {Visualize, VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
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

  it('prettifies wildcard operators in _if chart titles', async () => {
    const contains = '\uF00DContains\uF00D';
    const visualize = new VisualizeFunction(
      `avg_if(\`span.op:${contains}db\`,span.duration)`
    );

    render(
      <SpansQueryParamsProvider>
        <ChartSelectionProvider>
          <ExploreCharts
            extrapolate={false}
            query=""
            timeseriesResult={timeseriesResultFixture()}
            visualizes={[visualize]}
            setVisualizes={() => {}}
            rawSpanCounts={{
              total: {count: 0, isLoading: false},
              normal: {count: 0, isLoading: false},
            }}
            samplingMode={SAMPLING_MODE.HIGH_ACCURACY}
          />
        </ChartSelectionProvider>
      </SpansQueryParamsProvider>,
      {
        organization: OrganizationFixture(),
      }
    );

    expect(await screen.findByText(/span\.op:\*db\*/)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(contains))).not.toBeInTheDocument();
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
});
