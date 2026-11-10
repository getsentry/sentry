import type {ReactNode} from 'react';
import {HeatMapSeriesFixture} from 'sentry-fixture/heatMapSeries';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {HeatMapZoomContext} from 'sentry/views/dashboards/widgets/heatMapWidget/heatMapWidgetVisualization';

import {defaultMetricQuery, encodeMetricQueryParams} from './metricQuery';
import {MetricsHeatMap} from './metricsHeatMap';
import {MetricsQueryParamsProvider} from './metricsQueryParams';
import {
  MultiMetricsQueryParamsProvider,
  useMultiMetricsQueryParams,
} from './multiMetricsQueryParams';

jest.mock(
  'sentry/views/dashboards/widgets/heatMapWidget/heatMapWidgetVisualization',
  () => ({
    ...jest.requireActual(
      'sentry/views/dashboards/widgets/heatMapWidget/heatMapWidgetVisualization'
    ),
    HeatMapWidgetVisualization: ({
      onZoom,
    }: {
      onZoom: (context: HeatMapZoomContext) => void;
    }) => (
      <button
        onClick={() =>
          onZoom({
            timestampStart: Date.UTC(2025, 0, 1, 10, 0, 30),
            timestampEnd: Date.UTC(2025, 0, 1, 11, 0, 30),
            valueMin: 1,
            valueMax: 5,
          })
        }
      >
        Zoom
      </button>
    ),
  })
);

function FirstMetricQueryProvider({children}: {children: ReactNode}) {
  const [metricQuery] = useMultiMetricsQueryParams();
  return (
    <MetricsQueryParamsProvider
      traceMetric={metricQuery!.metric}
      queryParams={metricQuery!.queryParams}
      setQueryParams={() => {}}
      setTraceMetric={() => {}}
      removeMetric={() => {}}
    >
      {children}
    </MetricsQueryParamsProvider>
  );
}

describe('MetricsHeatMap', () => {
  it('pushes the zoomed value filter and time range in one history entry when zooming', async () => {
    const metric = encodeMetricQueryParams({
      ...defaultMetricQuery(),
      metric: {name: 'm', type: 'distribution'},
    });
    const initialQuery = {metric, project: '1', statsPeriod: '24h'};
    const {router} = render(
      <MultiMetricsQueryParamsProvider>
        <FirstMetricQueryProvider>
          <MetricsHeatMap
            actions={null}
            queryLabel="A"
            heatMapData={{
              error: null,
              isFetching: false,
              isPartial: false,
              isPending: false,
              series: HeatMapSeriesFixture({values: [{xAxis: 0, yAxis: 0, zAxis: 1}]}),
            }}
          />
        </FirstMetricQueryProvider>
      </MultiMetricsQueryParamsProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/metrics/',
            query: initialQuery,
          },
        },
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Zoom'}));
    await waitFor(() => expect(router.location.query.statsPeriod).toBeUndefined());
    const zoomedQuery = router.location.query;
    act(() => router.navigate(-1));

    expect(zoomedQuery).toEqual({
      metric: expect.stringContaining('value:>=1 value:<5'),
      project: '1',
      start: '2025-01-01T10:00:00',
      end: '2025-01-01T11:01:00',
    });
    expect(router.location.query).toEqual(initialQuery);
  });
});
