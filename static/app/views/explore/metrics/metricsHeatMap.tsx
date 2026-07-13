import {useCallback} from 'react';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {getUtcDateString} from 'sentry/utils/dates';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {WidgetLoadingPanel} from 'sentry/views/dashboards/widgets/common/widgetLoadingPanel';
import {
  HeatMapWidgetVisualization,
  type HeatMapZoomContext,
} from 'sentry/views/dashboards/widgets/heatMapWidget/heatMapWidgetVisualization';
import {HeatMap} from 'sentry/views/dashboards/widgets/heatMapWidget/plottables/heatMap';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import type {MetricHeatMapData} from 'sentry/views/explore/metrics/hooks/useMetricHeatMapData';
import {WidgetWrapper} from 'sentry/views/explore/metrics/metricGraph/styles';
import {encodeMetricQueryParams} from 'sentry/views/explore/metrics/metricQuery';
import {
  useMetricLabel,
  useMetricName,
  useMetricVisualize,
  useMetricVisualizes,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {STACKED_GRAPH_HEIGHT} from 'sentry/views/explore/metrics/settings';
import {prettifyAggregation} from 'sentry/views/explore/utils';
import {setExploreAttributeBounds} from 'sentry/views/explore/utils/setExploreAttributeBounds';

interface MetricsHeatMapProps {
  actions: React.ReactNode;
  heatMapData: MetricHeatMapData;
  /**
   * Stable label of this heat map's metric query (e.g., "A"), used to find the
   * matching row when drag-zooming. See `handleZoom`.
   */
  queryLabel: string;
  title?: string;
}

export function MetricsHeatMap({
  heatMapData,
  actions,
  title,
  queryLabel,
}: MetricsHeatMapProps) {
  const visualize = useMetricVisualize();
  const visualizes = useMetricVisualizes();
  const metricLabel = useMetricLabel();
  const metricName = useMetricName();
  const metricQueries = useMultiMetricsQueryParams();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    series: heatMapSeries,
    isPending,
    isPartial,
    isFetchingMore,
    error,
  } = heatMapData;

  const aggregate = visualize.yAxis;
  const chartTitle =
    visualizes.length > 1
      ? metricName
      : (title ?? metricLabel ?? prettifyAggregation(aggregate) ?? aggregate);

  // Drag-to-zoom changes two independent URL params at once: this row's `value`
  // filter (encoded inside the `metric` param) and the page time range
  // (`start`/`end`/`statsPeriod`). They have to land in a single `navigate`:
  // two navigations would each rebuild the whole query from the same stale
  // `location` snapshot and clobber each other, dropping one of the changes.
  //
  // So we hand-assemble that one navigation here — re-encode every metric row,
  // swapping the new `value` bounds into the row this heat map belongs to. That
  // row is found by its stable label ("A", "B", ...) rather than object
  // identity, because the metric queries are decoded fresh from the URL on
  // every render and share no reference across navigations.
  //
  // This is more manual than it should be. A URL-state library like Nuqs
  // (batched, functional param updates) would let a `value`-filter setter and a
  // datetime setter each update independently and coalesce into one URL write,
  // removing both the re-encode loop and the label lookup.
  const handleZoom = useCallback(
    ({timestampStart, timestampEnd, valueMin, valueMax}: HeatMapZoomContext) => {
      const metric = metricQueries
        .map(metricQuery => {
          if ((metricQuery.label ?? '') !== queryLabel) {
            return encodeMetricQueryParams(metricQuery);
          }
          const {queryParams} = metricQuery;
          return encodeMetricQueryParams({
            ...metricQuery,
            queryParams: queryParams.replace({
              query: setExploreAttributeBounds(
                queryParams.query,
                'value',
                valueMin,
                valueMax
              ),
            }),
          });
        })
        .filter(Boolean);

      navigate(
        {
          ...location,
          query: {
            ...location.query,
            metric,
            start: getUtcDateString(Math.floor(timestampStart / 60_000) * 60_000),
            end: getUtcDateString(Math.ceil(timestampEnd / 60_000) * 60_000),
            statsPeriod: undefined,
          },
        },
        {preventScrollReset: true}
      );
    },
    [metricQueries, location, navigate, queryLabel]
  );

  const hasChart =
    !error && !isPending && heatMapSeries && heatMapSeries.values.length > 0;

  let visualization: React.ReactNode;
  if (error) {
    visualization = <Widget.WidgetError error={error} />;
  } else if (isPending || !heatMapSeries) {
    visualization = <WidgetLoadingPanel />;
  } else if (heatMapSeries.values.length === 0) {
    visualization = <Widget.WidgetError error={t('No data')} />;
  } else {
    // While more chunks stream in, dim the already-rendered grid behind a
    // centered spinner so you get a peek at the data loading underneath. Every
    // visible cell is final; we're only filling in more columns.
    visualization = (
      <Container position="relative" height="100%">
        <HeatMapWidgetVisualization
          plottables={[new HeatMap(heatMapSeries)]}
          onZoom={handleZoom}
        />
        {isFetchingMore ? <StreamingOverlay /> : null}
      </Container>
    );
  }

  // A failed chunk leaves a gap; note it without blocking the rest of the grid.
  const footer =
    hasChart && isPartial ? (
      <Text size="sm" variant="warning">
        {t('Some data could not be loaded')}
      </Text>
    ) : null;

  return (
    <WidgetWrapper>
      <Widget
        Title={<Widget.WidgetTitle title={chartTitle} />}
        Actions={actions}
        Visualization={visualization}
        Footer={footer}
        height={STACKED_GRAPH_HEIGHT}
        revealActions="always"
        borderless
      />
    </WidgetWrapper>
  );
}

/**
 * A translucent mask + centered spinner over the grid while more chunks stream
 * in, so the already-rendered data stays visible underneath.
 */
function StreamingOverlay() {
  return (
    <Flex position="absolute" inset="0" align="center" justify="center">
      <Container
        position="absolute"
        inset="0"
        background="primary"
        style={{opacity: 0.5}}
      />
      <LoadingIndicator mini />
    </Flex>
  );
}
