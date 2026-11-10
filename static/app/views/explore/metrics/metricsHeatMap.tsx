import {useCallback} from 'react';
import {useQueryStates} from 'nuqs';

import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {getUtcDateString} from 'sentry/utils/dates';
import {pageFilterParsers} from 'sentry/utils/url/pageFilterParsers';
import {WidgetLoadingPanel} from 'sentry/views/dashboards/widgets/common/widgetLoadingPanel';
import {
  HeatMapWidgetVisualization,
  type HeatMapZoomContext,
} from 'sentry/views/dashboards/widgets/heatMapWidget/heatMapWidgetVisualization';
import {HeatMap} from 'sentry/views/dashboards/widgets/heatMapWidget/plottables/heatMap';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {parseAsFieldList} from 'sentry/views/explore/queryParams/parsers';
import {prettifyAggregation} from 'sentry/views/explore/utils';
import {setExploreAttributeBounds} from 'sentry/views/explore/utils/setExploreAttributeBounds';

import type {MetricHeatMapData} from './hooks/useMetricHeatMapData';
import {WidgetWrapper} from './metricGraph/styles';
import {encodeMetricQueryParams} from './metricQuery';
import {
  useMetricLabel,
  useMetricName,
  useMetricVisualize,
  useMetricVisualizes,
} from './metricsQueryParams';
import {useMultiMetricsQueryParams} from './multiMetricsQueryParams';
import {STACKED_GRAPH_HEIGHT} from './settings';

const ZOOM_QUERY_PARSERS = {
  metric: parseAsFieldList,
  start: pageFilterParsers.start,
  end: pageFilterParsers.end,
  statsPeriod: pageFilterParsers.statsPeriod,
};

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
  const [, setZoomQueryParams] = useQueryStates(ZOOM_QUERY_PARSERS, {history: 'push'});

  const {series: heatMapSeries, isPending, isPartial, isFetching, error} = heatMapData;

  const aggregate = visualize.yAxis;
  const chartTitle =
    visualizes.length > 1
      ? metricName
      : (title ?? metricLabel ?? prettifyAggregation(aggregate) ?? aggregate);

  // One write: a separate updateDateTime navigate would drop the pending `metric` write.
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

      void setZoomQueryParams({
        metric,
        start: getUtcDateString(Math.floor(timestampStart / 60_000) * 60_000),
        end: getUtcDateString(Math.ceil(timestampEnd / 60_000) * 60_000),
        statsPeriod: null,
      });
    },
    [metricQueries, setZoomQueryParams, queryLabel]
  );

  const hasChart =
    !error && !isPending && heatMapSeries && heatMapSeries.values.length > 0;

  let visualization: React.ReactNode;
  if (error) {
    visualization = <Widget.WidgetError error={error} />;
  } else if (
    !isPending &&
    !isFetching &&
    (!heatMapSeries || heatMapSeries.values.length === 0)
  ) {
    // We are no longer pending any data, and none has come back
    visualization = <Widget.WidgetError error={t('No data')} />;
  } else if (heatMapSeries) {
    // Show a loading spinner over the existing data while chunks are loading.
    // This improves perception of performance over a spinner that blocks the
    // UI.
    visualization = (
      <Container position="relative" height="100%">
        <HeatMapWidgetVisualization
          plottables={[new HeatMap(heatMapSeries)]}
          onZoom={handleZoom}
        />
        {isFetching || isPending ? <LoadingOverlay /> : null}
      </Container>
    );
  } else {
    // The query is not enabled yet, waiting for measurement
    visualization = <WidgetLoadingPanel />;
  }

  // A failed chunk leaves a gap. Note it but allow users to browse the loaded data.
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

function LoadingOverlay() {
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
