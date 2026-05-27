import 'echarts/lib/chart/heatmap';

import {Fragment, useRef, type ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import type {
  TooltipFormatterCallback,
  TopLevelFormatterParams,
} from 'echarts/types/dist/shared';

import {Flex} from '@sentry/scraps/layout';
import {useRenderToString} from '@sentry/scraps/renderToString';

import {BaseChart} from 'sentry/components/charts/baseChart';
import {defaultFormatAxisLabel} from 'sentry/components/charts/components/tooltip';
import {isChartHovered} from 'sentry/components/charts/utils';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {ECHARTS_MISSING_DATA_VALUE} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';
import {useOrganization} from 'sentry/utils/useOrganization';
import {NO_PLOTTABLE_VALUES} from 'sentry/views/dashboards/widgets/common/settings';
import {formatYAxisValue} from 'sentry/views/dashboards/widgets/heatMapWidget/formatters/formatYAxisValue';
import {plottablesCanBeVisualized} from 'sentry/views/dashboards/widgets/plottablesCanBeVisualized';
import {formatTooltipValue} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTooltipValue';
import {formatXAxisTimestamp} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatXAxisTimestamp';
import {FALLBACK_TYPE} from 'sentry/views/dashboards/widgets/timeSeriesWidget/settings';
import {getExploreUrl, type GetExploreUrlArgs} from 'sentry/views/explore/utils';

import {HeatMap} from './plottables/heatMap';
import type {HeatMapPlottable} from './plottables/heatMapPlottable';
import {HEATMAP_COLORS} from './settings';

// This is the ECharts default font size for axis labels. We need to use this number to do axis label frequency calculations
const Y_AXIS_LABEL_FONT_SIZE = 12;

interface HeatMapWidgetVisualizationProps {
  /**
   * An single `HeatMap` object to render on the chart, and any number of other compatible Heat Map plottables.
   */
  plottables: [HeatMap, ...HeatMapPlottable[]];
  /**
   * Experimental! Specify the Z-axis scale type. Logarithmic scales can be much more useful for values with a high range.
   */
  scale?: 'linear' | 'log';
  /**
   * getExploreUrl props that will be used to generate an explore link for the tooltip. Omitting this will not generate an explore link.
   */
  tooltipExploreUrlArgs?: Omit<GetExploreUrlArgs, 'organization'>;
}

export function HeatMapWidgetVisualization(props: HeatMapWidgetVisualizationProps) {
  const {plottables} = props;
  const theme = useTheme();
  const organization = useOrganization();
  const renderToString = useRenderToString();

  const pageFilters = usePageFilters();
  const {start, end, period, utc} = pageFilters.selection.datetime;
  const chartRef = useRef<ReactEchartsRef | null>(null);

  if (!plottablesCanBeVisualized(plottables)) {
    throw new Error(NO_PLOTTABLE_VALUES);
  }

  // TODO: Would be wise to guard against Y-axis type mismatches, we don't want
  // to support multi-axis here.

  const {scale = 'linear'} = props;

  const series = plottables.flatMap(plottable =>
    plottable.toSeries({
      theme,
      scale,
    })
  );

  const heatMapPlottable = plottables[0];

  const yAxisDataType = heatMapPlottable.yAxisValueType;
  const yAxisDataUnit = heatMapPlottable.yAxisValueUnit;

  const Zmax =
    scale === 'log' ? Math.log1p(heatMapPlottable.Zend) : heatMapPlottable.Zend;

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

  const yAxisBucketSize = heatMapPlottable.heatMapSeries.meta.yAxis.bucketSize;
  const yAxisBucketCount = heatMapPlottable.heatMapSeries.meta.yAxis.bucketCount;

  // Create tooltip formatter
  const formatTooltip: TooltipFormatterCallback<TopLevelFormatterParams> = params => {
    // Only show the tooltip of the current chart. Otherwise, all tooltips
    // in the chart group appear.
    if (!isChartHovered(chartRef?.current)) {
      return '';
    }

    const seriesParams = Array.isArray(params) ? params : [params];

    // Filter null values from tooltip
    const filteredParams = seriesParams.filter(param => {
      // @ts-expect-error ECharts types param.value as unknown, but we know it's [xAxis, yAxis, zAxis] from our HeatMap plottable
      const value = extractValue(param.value[2]);
      return value !== null;
    });

    let formattedXValue = ECHARTS_MISSING_DATA_VALUE;

    const xAxisBucketSize = heatMapPlottable.heatMapSeries.meta.xAxis.bucketSize;
    const yAxisUnit = heatMapPlottable?.yAxisValueUnit;
    const yAxisValueType = heatMapPlottable?.yAxisValueType ?? FALLBACK_TYPE;

    return renderToString(
      <Fragment>
        <div className="tooltip-series">
          {filteredParams.map(param => {
            let rawXValue: number | undefined;
            let rawYValue: number | undefined;

            let formattedYValue = ECHARTS_MISSING_DATA_VALUE;
            let formattedZValue = ECHARTS_MISSING_DATA_VALUE;
            if (Array.isArray(param.value) && param.value.length === 3) {
              const [xValue, yValue, zValue] = param.value;

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
                const yAxisMinValueFormatted = formatTooltipValue(
                  yValue,
                  yAxisValueType,
                  yAxisUnit ?? undefined
                );

                if (yAxisBucketSize === 0) {
                  formattedYValue = yAxisMinValueFormatted;
                } else {
                  const yAxisMaxValueFormatted = formatTooltipValue(
                    yValue + yAxisBucketSize,
                    yAxisValueType,
                    yAxisUnit ?? undefined
                  );

                  formattedYValue = `${yAxisMinValueFormatted} – ${yAxisMaxValueFormatted}`;
                }
              }

              if (defined(zValue) && typeof zValue === 'number') {
                formattedZValue = formatAbbreviatedNumber(zValue, 4, false);
              }
            }

            let exploreLink: ReactNode;

            if (defined(rawXValue) && defined(rawYValue) && props.tooltipExploreUrlArgs) {
              const xAxisMaxValue = rawXValue + xAxisBucketSize * 1000;
              const yAxisMaxValue = rawYValue + yAxisBucketSize;

              const exploreUrlProps: GetExploreUrlArgs = {
                organization,
                ...props.tooltipExploreUrlArgs,
                selection: {
                  ...pageFilters.selection,
                  datetime: {
                    ...pageFilters.selection.datetime,
                    start: new Date(rawXValue),
                    end: new Date(xAxisMaxValue),
                    period: null,
                  },
                },
                // TODO(nikki): we're only handling metrics for now but if we're looking to support other explore
                // surfaces then we'll need to add more logic here
                crossEvents: props.tooltipExploreUrlArgs?.crossEvents?.map(crossEvent => {
                  if (crossEvent.type === 'metrics') {
                    return {
                      ...crossEvent,
                      query:
                        yAxisBucketSize === 0
                          ? `value:<=${rawYValue}`
                          : `value:>=${rawYValue} value:<${yAxisMaxValue}`,
                    };
                  }
                  return crossEvent;
                }),
              };

              const tracesLink = getExploreUrl(exploreUrlProps);
              exploreLink = <a href={tracesLink}>{t('View related traces')}</a>;
            }

            return (
              <Fragment key={param.seriesIndex}>
                <div>
                  <span className="tooltip-label">
                    <strong>{formattedYValue}</strong>
                  </span>{' '}
                  {formattedZValue}
                </div>
                {exploreLink && (
                  <div>
                    <span className="tooltip-label tooltip-label-centered">
                      {exploreLink}
                    </span>
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
        <div className="tooltip-footer tooltip-footer-centered">{formattedXValue}</div>
        <div className="tooltip-arrow" />
      </Fragment>
    );
  };

  return (
    <Flex direction="column" height="100%">
      <BaseChart
        autoHeightResize
        // will be grouped by date as we only support time as the x-axis right now.
        // TODO(nikki): eventually this might change and we'll pass in what kind of x-axis we have
        isGroupedByDate
        showTimeInTooltip
        ref={chartRef}
        tooltip={{
          show: true,
          enterable: true,
          extraCssText: `box-shadow: 0 0 0 1px ${theme.tokens.border.transparent.neutral.muted}, ${theme.shadow.high}; z-index: ${theme.zIndex.tooltip} !important; pointer-events: auto !important;`,
          axisPointer: {
            show: false,
          },
          triggerOn: 'click',
          formatter: formatTooltip,
        }}
        series={series}
        xAxis={{
          type: 'category',
          animation: false,
          axisLabel: {
            formatter: value => {
              // NOTE: ECharts requires a `"category"` X-axis for heat maps, but we _know_ that we only support time as the X-axis. We need to parse the value here.
              return formatXAxisTimestamp(parseFloat(value), {
                utc: utc ?? undefined,
              });
            },
          },
          axisPointer: {
            show: false,
          },
          splitArea: {
            show: false,
          },
        }}
        yAxis={{
          type: 'category',
          animation: false,
          axisLabel: {
            hideOverlap: true,
            interval: (index, _value) => {
              // show the first and last label
              if (index === 0 || index === yAxisBucketCount - 1) {
                return true;
              }
              // we want to make sure that there's going to be ample amount of space between each label:
              // chart height / label size = number of labels that will fix with no space between
              // chart height / (label size * 3) = number of labels that will fit with space between (label shown every 3 label placements)
              // NOTE: this may change as we start putting heat widgets in dashboards with different chart heights
              const numFittingLabels = Math.floor(
                (chartRef.current?.ele.clientHeight ?? 0) / (Y_AXIS_LABEL_FONT_SIZE * 3)
              );
              const nthBucketToShow = Math.ceil(yAxisBucketCount / numFittingLabels);
              // don't show the third last and second last labels; we want to make sure the last label
              // isn't smushed up against another label
              if (
                index % nthBucketToShow === 0 &&
                index !== yAxisBucketCount - 3 &&
                index !== yAxisBucketCount - 2
              ) {
                return true;
              }
              return false;
            },
            showMinLabel: true,
            showMaxLabel: true,
            formatter: value => {
              // NOTE: ECharts requires a `"category"` Y-axis for heat maps, but we _know_ that we only support continuous values for the Y-axis. We need to parse the value here.
              return formatYAxisValue(
                parseFloat(value),
                yAxisDataType,
                yAxisDataUnit ?? undefined
              );
            },
          },
          axisPointer: {
            show: false,
          },
          splitArea: {
            show: false,
          },
        }}
        visualMap={[
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
          // All values are plotted against a palette
          {
            type: 'continuous',
            show: false,
            dimension: 2,
            seriesIndex: 0,
            min: 0,
            max: Zmax,
            inRange: {
              color: [...HEATMAP_COLORS],
            },
          },
        ]}
        start={start ? new Date(start) : undefined}
        end={end ? new Date(end) : undefined}
        period={period}
        utc={utc ?? undefined}
      />
    </Flex>
  );
}
