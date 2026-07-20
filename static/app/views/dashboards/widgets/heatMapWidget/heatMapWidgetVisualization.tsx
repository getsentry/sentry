import 'echarts/lib/chart/heatmap';

import {useCallback, useEffect, useRef, type ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import type {
  TooltipFormatterCallback,
  TopLevelFormatterParams,
  VisualMapComponentOption,
} from 'echarts/types/dist/shared';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {useRenderToString} from '@sentry/scraps/renderToString';
import {Text} from '@sentry/scraps/text';

import {BaseChart} from 'sentry/components/charts/baseChart';
import {defaultFormatAxisLabel} from 'sentry/components/charts/components/tooltip';
import {
  useChartBoxZoom,
  type BoxZoomRange,
} from 'sentry/components/charts/useChartBoxZoom';
import {isChartHovered, truncationFormatter} from 'sentry/components/charts/utils';
import {CircleIndicator} from 'sentry/components/circleIndicator';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {getUserTimezone} from 'sentry/utils/dates';
import {defined} from 'sentry/utils/defined';
import {ECHARTS_MISSING_DATA_VALUE} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';
import {useNavigate} from 'sentry/utils/useNavigate';
import {NO_PLOTTABLE_VALUES} from 'sentry/views/dashboards/widgets/common/settings';
import {WidgetLoadingPanel} from 'sentry/views/dashboards/widgets/common/widgetLoadingPanel';
import {formatTooltipYAxisValue} from 'sentry/views/dashboards/widgets/heatMapWidget/formatters/formatTooltipYAxisValue';
import {formatTooltipZAxisValue} from 'sentry/views/dashboards/widgets/heatMapWidget/formatters/formatTooltipZAxisValue';
import {
  HIDDEN_CATEGORY_AXIS,
  heatMapTimeAxis,
  heatMapValueAxis,
} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/heatMapAxes';
import {plottablesCanBeVisualized} from 'sentry/views/dashboards/widgets/plottablesCanBeVisualized';
import {FALLBACK_TYPE} from 'sentry/views/dashboards/widgets/timeSeriesWidget/settings';

import {HeatMap} from './plottables/heatMap';
import type {HeatMapPlottable} from './plottables/heatMapPlottable';
import {HEATMAP_COLORS} from './settings';

interface HeatMapWidgetVisualizationProps {
  /**
   * An single `HeatMap` object to render on the chart, and any number of other compatible Heat Map plottables.
   */
  plottables: [HeatMap, ...HeatMapPlottable[]];
  /**
   * Called when the user drag-selects a region of the heat map. The X-axis
   * range maps to a time range and the Y-axis range to a value range. When
   * omitted, drag-to-zoom is disabled.
   */
  onZoom?: (context: HeatMapZoomContext) => void;
  /**
   * Renders extra content in a cell's tooltip. Because ECharts renders the
   * tooltip to an HTML string (no live React handlers), the visualization
   * routes clicks for you: use `data-traces-link="<url>"` for navigations, and
   * `data-tooltip-action="<id>"` with `data-tooltip-action-value="<value>"` for
   * actions. The matching `tooltipActionHandlers[id]` is called with the value.
   */
  renderTooltipActions?: (context: HeatMapTooltipContext) => ReactNode;
  /**
   * Handlers for caller-rendered tooltip actions, keyed by the button's
   * `data-tooltip-action` id. Clicking such a button calls the matching handler
   * with its `data-tooltip-action-value`.
   */
  tooltipActionHandlers?: Record<string, (value: string) => void>;
}

export function HeatMapWidgetVisualization(props: HeatMapWidgetVisualizationProps) {
  const {plottables, tooltipActionHandlers, renderTooltipActions, onZoom} = props;
  const theme = useTheme();
  const renderToString = useRenderToString();
  const navigate = useNavigate();
  const pageFilters = usePageFilters();
  const {start, end, period, utc} = pageFilters.selection.datetime;
  const timezone = utc ? 'UTC' : getUserTimezone();
  const chartRef = useRef<ReactEchartsRef | null>(null);

  // yes i am aware that this is UGLY but it's a hack so that we can use proper react routing.
  // Basically the way ECharts renders the tooltip is by creating a string out of the dom tree.
  // This means that we can't use any of the normal linking/routing tools that we use in React trees
  // because they require contexts that won't be available properly in this string tree.
  // Using the `<a>` tag will make the page reload and navigate to the url because it doesn't have
  // link history context. Doing the navigation here preserves the link history context and makes the
  // page navigation smoother instead of reloading the page every time a link is clicked.
  const handleTooltipLinksClick = useCallback(
    (e: MouseEvent) => {
      if (!chartRef.current?.ele?.contains(e.target as Node)) {
        return;
      }

      const actionTarget = (e.target as Element).closest('[data-tooltip-action]');

      const tracesLinkTarget = (e.target as Element).closest('[data-traces-link]');

      if (!actionTarget && !tracesLinkTarget) {
        return;
      }

      e.preventDefault();

      const openInNewTab = e.metaKey || e.ctrlKey;

      if (actionTarget) {
        const actionId = actionTarget.getAttribute('data-tooltip-action');
        const handler = actionId ? tooltipActionHandlers?.[actionId] : undefined;
        handler?.(actionTarget.getAttribute('data-tooltip-action-value') ?? '');
      }

      if (tracesLinkTarget) {
        const tracesUrl = tracesLinkTarget.getAttribute('data-traces-link');
        if (tracesUrl) {
          if (openInNewTab) {
            window.open(tracesUrl, '_blank');
          } else {
            navigate(tracesUrl);
          }
        }
      }
    },
    [navigate, tooltipActionHandlers]
  );

  useEffect(() => {
    document.addEventListener('click', handleTooltipLinksClick);
    return () => document.removeEventListener('click', handleTooltipLinksClick);
  }, [handleTooltipLinksClick]);

  const handleZoom = useCallback(
    (range: BoxZoomRange) => {
      onZoom?.({
        timestampStart: range.xRange[0],
        timestampEnd: range.xRange[1],
        valueMin: range.yRange[0],
        valueMax: range.yRange[1],
      });
    },
    [onZoom]
  );

  // The heat map's readable time/value axes sit at index 1; index 0 is the
  // hidden category axis that positions the cells.
  const {onChartReady, isDraggingRef} = useChartBoxZoom({
    onZoom: onZoom ? handleZoom : undefined,
    xAxisIndex: 1,
    yAxisIndex: 1,
  });

  if (!plottablesCanBeVisualized(plottables)) {
    throw new Error(NO_PLOTTABLE_VALUES);
  }

  // TODO: Would be wise to guard against Y-axis type mismatches, we don't want
  // to support multi-axis here.

  const series = plottables.flatMap(plottable =>
    plottable.toSeries({
      theme,
    })
  );

  const heatMapPlottable = plottables[0];

  const yAxisDataType = heatMapPlottable.yAxisValueType;
  const yAxisDataUnit = heatMapPlottable.yAxisValueUnit;

  /** Extract the numeric value from ECharts tooltip param.value. */
  function extractValue(data: unknown): number | null {
    // param.value can be either:
    // 1. The numeric value directly (for heatmap charts with axis trigger)
    // 2. An object {name, value} (depends on series config)
    if (typeof data === 'number') {
      return data;
    }

    const value = (data as {value?: unknown} | null | undefined)?.value;
    return typeof value === 'number' ? value : null;
  }

  const {meta} = heatMapPlottable.heatMapSeries;
  const yAxisBucketSize = meta.yAxis.bucketSize;

  // Create tooltip formatter
  const formatTooltip: TooltipFormatterCallback<TopLevelFormatterParams> = params => {
    // Skip the tooltip during a drag. This improves drag performance since the
    // tooltip's `renderToString` is expensive.
    if (isDraggingRef.current) {
      return '';
    }

    // Only show the tooltip of the current chart. Otherwise, all tooltips
    // in the chart group appear.
    if (!isChartHovered(chartRef?.current)) {
      return '';
    }

    const seriesParams = Array.isArray(params) ? params : [params];

    // Hide tooltip for 0 cells. No point showing empty data.
    const filteredParams = seriesParams.filter(param => {
      // @ts-expect-error ECharts types param.value as unknown, but we know it's [xAxis, yAxis, colorPosition, rawCount] from our HeatMap plottable
      const value = extractValue(param.value[3]);
      return value !== null && value !== 0;
    });

    if (filteredParams.length === 0) {
      return '';
    }

    let formattedXValue = ECHARTS_MISSING_DATA_VALUE;

    const xAxisBucketSize = heatMapPlottable.heatMapSeries.meta.xAxis.bucketSize;
    const yAxisUnit = heatMapPlottable?.yAxisValueUnit;
    const yAxisValueType = heatMapPlottable?.yAxisValueType ?? FALLBACK_TYPE;

    const yAxisLabel = t('value');
    const zAxisLabel = truncationFormatter(meta.zAxis.name || 'count()', true, false);

    return renderToString(
      <Container>
        <Container padding="lg">
          {filteredParams.map(param => {
            let rawXValue: number | undefined;
            let rawYValue: number | undefined;

            let formattedYValue = ECHARTS_MISSING_DATA_VALUE;
            let formattedZValue = ECHARTS_MISSING_DATA_VALUE;
            if (Array.isArray(param.value) && param.value.length === 4) {
              // [xAxis, yAxis, colorPosition, rawCount] — index 2 is the
              // equalized color position; the true count lives at index 3.
              const [xValue, yValue, , zValue] = param.value;

              if (defined(xValue) && typeof xValue === 'number') {
                rawXValue = xValue;
                // bucket size seems to be in seconds but we need to convert to milliseconds
                formattedXValue = defaultFormatAxisLabel(
                  xValue,
                  true,
                  utc ?? false,
                  true,
                  false,
                  xAxisBucketSize * 1000
                ).toString();
              }

              if (defined(yValue) && typeof yValue === 'number') {
                rawYValue = yValue;
                formattedYValue = formatTooltipYAxisValue(
                  yValue,
                  yAxisBucketSize,
                  yAxisValueType,
                  yAxisUnit ?? undefined
                );
              }

              if (defined(zValue) && typeof zValue === 'number') {
                // `zValue` is the raw count carried through on dim 3, so it can
                // be formatted directly (the color position on dim 2 is what's
                // been transformed, not this).
                formattedZValue = formatTooltipZAxisValue(zValue);
              }
            }

            // Pull the cell color directly out of ECharts instead of
            // re-calculating it using the palette.
            const cellColor = typeof param.color === 'string' ? param.color : undefined;

            let tooltipActions: ReactNode = null;
            if (defined(rawXValue) && defined(rawYValue) && renderTooltipActions) {
              tooltipActions = renderTooltipActions({
                valueMin: rawYValue,
                valueMax: rawYValue + yAxisBucketSize,
                timestampStart: rawXValue,
                timestampEnd: rawXValue + xAxisBucketSize * 1000,
              });
            }

            return (
              <Stack gap="sm" key={param.seriesIndex}>
                <Flex justify="between" gap="xl">
                  <Text variant="primary" size="sm">
                    {yAxisLabel}
                  </Text>
                  <Text variant="muted" size="sm">
                    {formattedYValue}
                  </Text>
                </Flex>
                <Flex justify="between" gap="xl">
                  <Flex align="center" gap="xs">
                    <CircleIndicator as="span" size={8} color={cellColor} />
                    <Text variant="primary" size="sm">
                      {zAxisLabel}
                    </Text>
                  </Flex>
                  <Text variant="muted" size="sm">
                    {formattedZValue}
                  </Text>
                </Flex>

                {tooltipActions}
              </Stack>
            );
          })}
        </Container>
        {/* Tooltip footer styles are a bit hard to emulate, let's use the
        existing ones for now. */}
        <div
          className="tooltip-footer tooltip-footer-centered"
          style={{cursor: 'default'}}
        >
          {formattedXValue}
        </div>
        <div className="tooltip-arrow" />
      </Container>
    );
  };

  return (
    <Stack height="100%">
      <BaseChart
        autoHeightResize
        // will be grouped by date as we only support time as the x-axis right now.
        // TODO(nikki): eventually this might change and we'll pass in what kind of x-axis we have
        isGroupedByDate
        showTimeInTooltip
        ref={chartRef}
        onChartReady={onChartReady}
        tooltip={{
          show: true,
          enterable: true,
          extraCssText: `box-shadow: 0 0 0 1px ${theme.tokens.border.transparent.neutral.muted}, ${theme.shadow.high}; z-index: ${theme.zIndex.tooltip} !important; pointer-events: auto !important;`,
          axisPointer: {
            show: false,
          },
          triggerOn: 'mousemove',
          formatter: formatTooltip,
        }}
        series={series}
        xAxes={[
          HIDDEN_CATEGORY_AXIS,
          heatMapTimeAxis({
            min: meta.xAxis.start,
            max: meta.xAxis.end,
            timezone,
          }),
        ]}
        yAxes={[
          HIDDEN_CATEGORY_AXIS,
          heatMapValueAxis({
            min: meta.yAxis.start,
            max: meta.yAxis.end,
            valueType: yAxisDataType,
            valueUnit: yAxisDataUnit ?? undefined,
          }),
        ]}
        visualMap={visualMapOptions(HEATMAP_COLORS)}
        start={start ? new Date(start) : undefined}
        end={end ? new Date(end) : undefined}
        period={period}
        utc={utc ?? undefined}
      />
    </Stack>
  );
}

export const visualMapOptions = (
  colors: readonly string[]
): VisualMapComponentOption[] => {
  return [
    // Zero values are transparent (empty buckets)
    {
      type: 'piecewise',
      show: false,
      dimension: 2,
      seriesIndex: 0,
      pieces: [
        {value: 0, opacity: 0},
        {gt: 0, opacity: 1},
      ],
    },
    // Color positions are already equalized into [0, 1] by `heatMapColorScale`,
    // so the continuous map just spans the palette across that fixed range.
    {
      type: 'continuous',
      show: false,
      dimension: 2,
      seriesIndex: 0,
      min: 0,
      max: 1,
      inRange: {
        color: [...colors],
      },
    },
  ];
};

/**
 * Bucket bounds of a region of the heat map, in raw axis units: a time span on
 * the X axis (ms since epoch) and a value span on the Y axis.
 */
interface HeatMapBucketBounds {
  timestampEnd: number;
  timestampStart: number;
  valueMax: number;
  valueMin: number;
}

/**
 * Context for the hovered heat map cell, handed to `renderTooltipActions` so the
 * caller can build its own tooltip actions (e.g., link into Explore).
 */
type HeatMapTooltipContext = HeatMapBucketBounds;

/**
 * Context for a drag-selected region, handed to `onZoom`.
 */
export type HeatMapZoomContext = HeatMapBucketBounds;

HeatMapWidgetVisualization.LoadingPlaceholder = WidgetLoadingPanel;
