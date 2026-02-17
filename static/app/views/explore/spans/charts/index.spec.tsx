import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ChartSelectionProvider} from 'sentry/views/explore/components/attributeBreakdowns/chartSelectionContext';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {ExploreCharts} from 'sentry/views/explore/spans/charts';
import {defaultVisualizes} from 'sentry/views/explore/spans/spansQueryParams';
import {SpansQueryParamsProvider} from 'sentry/views/explore/spans/spansQueryParamsProvider';

describe('ExploreCharts', () => {
  it('renders the high accuracy message when the widget is loading more data', async () => {
    const mockTimeseriesResult = {
      data: {},
      isLoading: true,
      isPending: true,
      isFetching: true,
    } as any;

    render(
      <SpansQueryParamsProvider>
        <ChartSelectionProvider>
          <ExploreCharts
            extrapolate
            setTab={() => {}}
            confidences={[]}
            query=""
            timeseriesResult={mockTimeseriesResult}
            visualizes={defaultVisualizes()}
            setVisualizes={() => {}}
            samplingMode={SAMPLING_MODE.HIGH_ACCURACY}
            rawSpanCounts={{
              highAccuracy: {count: 0, isLoading: true},
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

  it('renders one chart with combined series for multi-yAxis visualize', async () => {
    const mockTimeseriesResult = {
      data: {
        'avg(span.duration)': [],
        'p95(span.duration)': [],
      },
      isLoading: false,
      isPending: false,
      isFetching: false,
    } as any;

    render(
      <SpansQueryParamsProvider>
        <ChartSelectionProvider>
          <ExploreCharts
            extrapolate
            setTab={() => {}}
            confidences={[]}
            query=""
            timeseriesResult={mockTimeseriesResult}
            visualizes={[
              new VisualizeFunction(['avg(span.duration)', 'p95(span.duration)']),
            ]}
            setVisualizes={() => {}}
            rawSpanCounts={{
              highAccuracy: {count: 0, isLoading: false},
              normal: {count: 0, isLoading: false},
            }}
          />
        </ChartSelectionProvider>
      </SpansQueryParamsProvider>,
      {
        organization: OrganizationFixture(),
      }
    );

    expect(
      await screen.findByText(content => {
        return (
          content.includes('avg(') && content.includes('p95(') && content.includes(',')
        );
      })
    ).toBeInTheDocument();
  });
});
