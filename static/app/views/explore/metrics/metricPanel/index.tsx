import {Activity, Fragment, useRef, useState} from 'react';
import type {DraggableAttributes} from '@dnd-kit/core';
import type {SyntheticListenerMap} from '@dnd-kit/core/dist/hooks/utilities';
import {useQuery} from '@tanstack/react-query';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {getDiffInMinutes} from 'sentry/components/charts/utils';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {Placeholder} from 'sentry/components/placeholder';
import {IconClock, IconGraph} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {DataUnit} from 'sentry/utils/discover/fields';
import {intervalToMilliseconds} from 'sentry/utils/duration/intervalToMilliseconds';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {HeatMapSeries} from 'sentry/views/dashboards/widgets/common/types';
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
import {metricHeatmapApiOptions} from 'sentry/views/explore/metrics/hooks/metricHeatmapApiOptions';
import {useMetricAggregatesTable} from 'sentry/views/explore/metrics/hooks/useMetricAggregatesTable';
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
  useSetMetricVisualizes,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {MetricToolbar} from 'sentry/views/explore/metrics/metricToolbar';
import {STACKED_GRAPH_HEIGHT} from 'sentry/views/explore/metrics/settings';
import {
  mapMetricUnitToFieldType,
  updateVisualizeYAxis,
} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsMode,
  useQueryParamsQuery,
  useQueryParamsSortBys,
  useSetQueryParamsGroupBys,
} from 'sentry/views/explore/queryParams/context';
import {
  isVisualizeEquation,
  isVisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {ChartType} from 'sentry/views/insights/common/components/chart';

const RESULT_LIMIT = 50;
const TWO_MINUTE_DELAY = 120;

const CHART_TYPE_TO_ICON: Record<ChartType, 'line' | 'area' | 'bar' | 'scatter'> = {
  [ChartType.LINE]: 'line',
  [ChartType.AREA]: 'area',
  [ChartType.BAR]: 'bar',
  [ChartType.HEATMAP]: 'scatter',
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
  const groupBys = useQueryParamsGroupBys();
  const setGroupBys = useSetQueryParamsGroupBys();
  const [interval, setInterval, intervalOptions] = useChartInterval();
  const topEvents = useTopEvents();
  const visualize = useMetricVisualize();
  const visualizes = useMetricVisualizes();
  const setVisualizes = useSetMetricVisualizes();

  const [title, setTitle] = useState<string | undefined>(() => {
    if (isVisualizeEquation(visualize)) {
      return unresolveExpression(visualize.expression.text, referenceMap);
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

  const isHeatmap = visualize.chartType === ChartType.HEATMAP;
  const hasHeatMap = canUseMetricsHeatMap(organization);

  const {result: timeseriesResult} = useMetricTimeseries({
    traceMetric,
    enabled:
      !(hasHeatMap && isHeatmap) &&
      (!isMetricOptionsEmpty ||
        (isVisualizeEquation(visualize) && Boolean(visualize.expression.text))),
  });

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const {width: chartContainerWidth} = useDimensions({elementRef: chartContainerRef});
  const yBuckets = getHeatmapYBuckets(selection, interval, chartContainerWidth);

  const heatmapApiOptions = metricHeatmapApiOptions({
    traceMetric,
    enabled: hasHeatMap && isHeatmap && !isMetricOptionsEmpty && yBuckets > 0,
    organization,
    selection,
    query: userQuery,
    interval,
    yBuckets,
  });
  const heatmapResult = useQuery({
    ...heatmapApiOptions,
    select: data => {
      const series = heatmapApiOptions.select!(data);
      return mergeMetricUnit(series, traceMetric.unit ?? undefined);
    },
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
      setVisualizes(
        visualizes.map(v =>
          isVisualizeFunction(v)
            ? updateVisualizeYAxis(v, 'count', traceMetric).replace({
                chartType: ChartType.HEATMAP,
              })
            : v.replace({chartType: ChartType.HEATMAP})
        )
      );
      if (groupBys.length > 0) {
        setGroupBys([]);
      }
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
        options={getMetricsChartTypeOptions(organization)}
        onChange={option => handleChartTypeChange(option.value)}
      />
      <CompactSelect
        value={interval}
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

  const contentHeightRef = useRef<number | null>(null);

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
                  <Grid columns={{xs: '1fr', md: '1fr 1fr'}} gap="sm">
                    <Container minWidth="0" ref={chartContainerRef}>
                      {hasHeatMap && isHeatmap ? (
                        <MetricsHeatMap
                          heatmapResult={heatmapResult}
                          actions={actions}
                          title={title}
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

/**
 * Computes the number of Y-axis buckets for the heatmap API so that cells
 * are roughly square. The X-axis bucket count comes from the time range
 * divided by the selected interval. We derive Y buckets by scaling
 * xBuckets by the container's height/width aspect ratio.
 */
function getHeatmapYBuckets(
  selection: PageFilters,
  interval: string,
  chartContainerWidth: number
): number {
  const timeRangeInMs = getDiffInMinutes(selection.datetime) * 60 * 1000;
  const intervalInMs = intervalToMilliseconds(interval);
  if (intervalInMs <= 0 || chartContainerWidth <= 0) {
    return 0;
  }

  const xBuckets = Math.round(timeRangeInMs / intervalInMs);
  if (xBuckets <= 0) {
    return 0;
  }

  return Math.max(1, Math.round(xBuckets * (STACKED_GRAPH_HEIGHT / chartContainerWidth)));
}

/**
 * The heatmap API response doesn't include the metric unit because the
 * query uses the generic `value` field. This function patches the Y-axis
 * meta with the known unit from the selected trace metric so the
 * visualization can format axis labels correctly (e.g. "1.5 KB" instead
 * of "1500").
 */
function mergeMetricUnit(
  series: HeatMapSeries,
  metricUnit: string | undefined
): HeatMapSeries {
  const {fieldType, unit} = mapMetricUnitToFieldType(metricUnit);
  if (!unit) {
    return series;
  }
  return {
    ...series,
    meta: {
      ...series.meta,
      yAxis: {
        ...series.meta.yAxis,
        valueType: fieldType,
        valueUnit: unit as DataUnit,
      },
    },
  };
}
