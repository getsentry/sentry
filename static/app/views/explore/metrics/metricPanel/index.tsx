import {Activity, Fragment, useRef, useState} from 'react';
import type {DraggableAttributes} from '@dnd-kit/core';
import type {SyntheticListenerMap} from '@dnd-kit/core/dist/hooks/utilities';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {Placeholder} from 'sentry/components/placeholder';
import {IconClock, IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  ChartIntervalUnspecifiedStrategy,
  useChartInterval,
} from 'sentry/utils/useChartInterval';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {calculateHeatMapBucketDimensions} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/calculateHeatMapBucketDimensions';
import {EXPLORE_FIVE_MIN_STALE_TIME} from 'sentry/views/explore/constants';
import {useMetricsPanelAnalytics} from 'sentry/views/explore/hooks/useAnalytics';
import {useMetricOptions} from 'sentry/views/explore/hooks/useMetricOptions';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {
  DEFAULT_YAXIS_BY_TYPE,
  getTraceSamplesTableFields,
  TraceSamplesTableColumns,
} from 'sentry/views/explore/metrics/constants';
import {unresolveExpression} from 'sentry/views/explore/metrics/equationBuilder/utils';
import {useMetricAggregatesTable} from 'sentry/views/explore/metrics/hooks/useMetricAggregatesTable';
import {useMetricHeatMapData} from 'sentry/views/explore/metrics/hooks/useMetricHeatMapData';
import {useMetricSamplesTable} from 'sentry/views/explore/metrics/hooks/useMetricSamplesTable';
import {useMetricTimeseries} from 'sentry/views/explore/metrics/hooks/useMetricTimeseries';
import {
  MetricsGraph,
  getMetricsChartTypeOptions,
} from 'sentry/views/explore/metrics/metricGraph';
import {MetricInfoTabs} from 'sentry/views/explore/metrics/metricInfoTabs';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {canUseMetricsHeatMap} from 'sentry/views/explore/metrics/metricsFlags';
import {MetricsHeatMap} from 'sentry/views/explore/metrics/metricsHeatMap';
import {
  useMetricVisualize,
  useMetricVisualizes,
  useSetMetricAggregateFields,
  useSetMetricVisualizes,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MetricToolbar} from 'sentry/views/explore/metrics/metricToolbar';
import {STACKED_GRAPH_HEIGHT} from 'sentry/views/explore/metrics/settings';
import {updateVisualizeYAxis} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsMode,
  useQueryParamsQuery,
  useQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';
import {
  isVisualizeEquation,
  isVisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {ChartType} from 'sentry/views/insights/common/components/chart';

const RESULT_LIMIT = 50;
const TWO_MINUTE_DELAY = 120;

const CHART_TYPE_TO_ICON: Record<ChartType, 'line' | 'area' | 'bar' | 'heatmap'> = {
  [ChartType.LINE]: 'line',
  [ChartType.AREA]: 'area',
  [ChartType.BAR]: 'bar',
  [ChartType.HEATMAP]: 'heatmap',
};

interface MetricPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  queryIndex: number;
  queryLabel: string;
  traceMetric: TraceMetric;
  dragAttributes?: DraggableAttributes;
  dragListeners?: SyntheticListenerMap;
  isAnyDragging?: boolean;
  isDragging?: boolean;
  onEquationLabelsChange?: (equationLabel: string, labels: string[]) => void;
  ref?: React.Ref<HTMLDivElement>;
  referenceMap?: Record<string, string>;
  referencedMetricLabels?: Set<string>;
}

export function MetricPanel({
  traceMetric,
  queryIndex,
  queryLabel,
  referenceMap,
  dragListeners,
  isAnyDragging,
  isDragging,
  style,
  ref,
  dragAttributes,
  referencedMetricLabels,
  onEquationLabelsChange,
  ...rest
}: MetricPanelProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const userQuery = useQueryParamsQuery();
  const {isMetricOptionsEmpty} = useMetricOptions({enabled: Boolean(traceMetric.name)});

  const fields = getTraceSamplesTableFields(TraceSamplesTableColumns);

  const mode = useQueryParamsMode();
  const sortBys = useQueryParamsSortBys();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const topEvents = useTopEvents();
  const visualize = useMetricVisualize();
  const visualizes = useMetricVisualizes();
  const setVisualizes = useSetMetricVisualizes();
  const setAggregateFields = useSetMetricAggregateFields();

  const isHeatmap = visualize.chartType === ChartType.HEATMAP;

  const [interval, setInterval, intervalOptions] = useChartInterval({
    unspecifiedStrategy: ChartIntervalUnspecifiedStrategy.USE_SMALLEST,
  });

  const [title, setTitle] = useState<string | undefined>(() => {
    if (isVisualizeEquation(visualize)) {
      return (
        visualize.internalExpression ??
        unresolveExpression(visualize.expression.text, referenceMap)
      );
    }
    return;
  });

  const areQueriesEnabled = isVisualizeFunction(visualize)
    ? Boolean(traceMetric.name) && !isMetricOptionsEmpty
    : isVisualizeEquation(visualize) && Boolean(visualize.expression.text);

  const metricSamplesTableResult = useMetricSamplesTable({
    disabled: !areQueriesEnabled,
    limit: RESULT_LIMIT,
    traceMetric,
    fields,
    ingestionDelaySeconds: TWO_MINUTE_DELAY,
    staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
  });

  const metricAggregatesTableResult = useMetricAggregatesTable({
    enabled: areQueriesEnabled,
    limit: RESULT_LIMIT,
    traceMetric,
    // We can use Infinity here because the data will remain the same, and if the args to
    // change the data changes, the cache will be invalidated.
    staleTime: Infinity,
  });

  const areHeatMapsEnabled = canUseMetricsHeatMap(organization);

  const {result: timeseriesResult} = useMetricTimeseries({
    traceMetric,
    enabled:
      !(areHeatMapsEnabled && isHeatmap) &&
      (!isMetricOptionsEmpty ||
        (isVisualizeEquation(visualize) && Boolean(visualize.expression.text))),
  });

  const contentHeightRef = useRef<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const {width: chartContainerWidth} = useDimensions({elementRef: chartContainerRef});

  const heatMapBucketDimensions = calculateHeatMapBucketDimensions(
    selection,
    {
      width: chartContainerWidth,
      height: STACKED_GRAPH_HEIGHT,
    },
    intervalOptions.map(intervalOption => intervalOption.value)
  );

  const heatMapData = useMetricHeatMapData({
    organization,
    selection,
    traceMetric,
    query: userQuery,
    interval: heatMapBucketDimensions?.interval,
    yBuckets: heatMapBucketDimensions?.yBuckets,
    enabled: areHeatMapsEnabled && isHeatmap && !isMetricOptionsEmpty,
  });

  useMetricsPanelAnalytics({
    interval,
    isTopN: !!topEvents,
    metricAggregatesTableResult,
    metricSamplesTableResult,
    metricTimeseriesResult: timeseriesResult,
    mode,
    traceMetric,
    sortBys,
    aggregateSortBys,
    panelIndex: queryIndex,
  });

  function handleChartTypeChange(newChartType: ChartType) {
    if (newChartType === ChartType.HEATMAP) {
      // Heatmap always uses count() with no group by
      setAggregateFields(
        visualizes.map(v =>
          isVisualizeFunction(v)
            ? updateVisualizeYAxis(v, 'count', traceMetric).replace({
                chartType: ChartType.HEATMAP,
              })
            : v.replace({chartType: ChartType.HEATMAP})
        )
      );
    } else if (isHeatmap) {
      // Switching away from heatmap — restore the default aggregate
      const defaultAggregate = DEFAULT_YAXIS_BY_TYPE[traceMetric.type] ?? 'count';
      setVisualizes(
        visualizes.map(v =>
          isVisualizeFunction(v)
            ? updateVisualizeYAxis(v, defaultAggregate, traceMetric).replace({
                chartType: newChartType,
              })
            : v.replace({chartType: newChartType})
        )
      );
    } else {
      setVisualizes(visualizes.map(v => v.replace({chartType: newChartType})));
    }
  }

  const actions = (
    <Fragment>
      <CompactSelect
        trigger={triggerProps => (
          <OverlayTrigger.Button
            {...triggerProps}
            data-test-id="metric-panel-chart-type-select"
            tooltipProps={{
              title: t('Type of chart displayed in this visualization (ex. line)'),
            }}
            icon={<IconGraph type={CHART_TYPE_TO_ICON[visualize.chartType]} />}
            variant="transparent"
            showChevron={false}
            size="xs"
          />
        )}
        value={visualize.chartType}
        menuTitle="Type"
        options={getMetricsChartTypeOptions(
          organization,
          isVisualizeEquation(visualize),
          traceMetric
        )}
        onChange={option => handleChartTypeChange(option.value)}
      />
      <CompactSelect
        value={isHeatmap ? (heatMapBucketDimensions?.interval ?? interval) : interval}
        disabled={isHeatmap}
        onChange={({value}) => setInterval(value)}
        trigger={triggerProps => (
          <OverlayTrigger.Button
            tooltipProps={{
              title: t('Time interval displayed in this visualization (ex. 5m)'),
            }}
            {...triggerProps}
            icon={<IconClock />}
            variant="transparent"
            showChevron={false}
            size="xs"
          />
        )}
        menuTitle="Interval"
        options={intervalOptions}
      />
    </Fragment>
  );

  return (
    <Panel ref={ref} style={style} {...rest} data-test-id="metric-panel">
      <PanelBody>
        <Stack gap="sm">
          <Container paddingBottom={visualize.visible ? undefined : 'sm'}>
            <MetricToolbar
              traceMetric={traceMetric}
              queryLabel={queryLabel}
              referenceMap={referenceMap}
              dragListeners={dragListeners}
              dragAttributes={dragAttributes}
              referencedMetricLabels={referencedMetricLabels}
              onEquationLabelsChange={onEquationLabelsChange}
              onTitleChange={setTitle}
            />
          </Container>
          {visualize.visible ? (
            <Fragment>
              {isAnyDragging ? (
                <DnDPlaceholder
                  isDragging={isDragging}
                  contentHeight={contentHeightRef.current}
                />
              ) : null}
              <Activity mode={isAnyDragging ? 'hidden' : 'visible'}>
                <Container
                  ref={containerRef => {
                    if (!isAnyDragging && containerRef) {
                      contentHeightRef.current = containerRef.offsetHeight ?? null;
                    }
                  }}
                >
                  <Grid columns={{'screen:xs': '1fr', 'screen:md': '1fr 1fr'}} gap="sm">
                    <Container minWidth="0" ref={chartContainerRef}>
                      {areHeatMapsEnabled && isHeatmap ? (
                        <MetricsHeatMap
                          heatMapData={heatMapData}
                          actions={actions}
                          title={title}
                          queryLabel={queryLabel}
                        />
                      ) : (
                        <MetricsGraph
                          timeseriesResult={timeseriesResult}
                          actions={actions}
                          isMetricOptionsEmpty={isMetricOptionsEmpty}
                          title={title}
                        />
                      )}
                    </Container>
                    <Container minWidth="0">
                      <MetricInfoTabs
                        traceMetric={traceMetric}
                        isMetricOptionsEmpty={isMetricOptionsEmpty}
                      />
                    </Container>
                  </Grid>
                </Container>
              </Activity>
            </Fragment>
          ) : null}
        </Stack>
      </PanelBody>
    </Panel>
  );
}

function DnDPlaceholder({
  contentHeight,
  isDragging,
}: {
  contentHeight: number | null;
  isDragging: boolean | undefined;
}) {
  return (
    <Container height={contentHeight ? `${contentHeight}px` : undefined}>
      <Grid columns="1fr 1fr" gap="sm" height="100%">
        <Container padding="md">
          <Placeholder height="100%">
            {isDragging ? (
              <Text>
                {t(
                  "Charts are hidden while reordering. They're too expensive to drag along for the ride."
                )}
              </Text>
            ) : null}
          </Placeholder>
        </Container>
        <Container padding="md" paddingLeft="0">
          <Placeholder height="100%">
            {isDragging ? (
              <Text>
                {t("We gotta hide the tables too, they're also pretty expensive.")}
              </Text>
            ) : null}
          </Placeholder>
        </Container>
      </Grid>
    </Container>
  );
}
