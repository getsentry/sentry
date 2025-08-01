import {useCallback, useMemo, useRef} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import type {
  CustomSeriesOption,
  CustomSeriesRenderItem,
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  CustomSeriesRenderItemReturn,
  GridComponentOption,
  LineSeriesOption,
  MarkAreaComponentOption,
  MarkLineComponentOption,
  TooltipComponentFormatterCallbackParams,
  YAXisComponentOption,
} from 'echarts';

import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import type {
  EChartMouseOutHandler,
  EChartMouseOverHandler,
  ReactEchartsRef,
  Series,
} from 'sentry/types/echarts';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';
import {
  AlertRuleSensitivity,
  AlertRuleThresholdType,
  TimePeriod,
} from 'sentry/views/alerts/rules/metric/types';
import type {Anomaly} from 'sentry/views/alerts/types';
import {AnomalyType} from 'sentry/views/alerts/types';
import {
  HISTORICAL_TIME_PERIOD_MAP,
  HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS,
} from 'sentry/views/alerts/utils/timePeriods';
import type {DetectorDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {useMetricDetectorSeries} from 'sentry/views/detectors/hooks/useMetricDetectorSeries';

import {useMetricDetectorAnomalies} from './useMetricDetectorAnomalies';

const ANOMALY_BUBBLE_SERIES_ID = '__anomaly_bubble__';
const ANOMALY_BUBBLE_AREA_SERIES_ID = '__anomaly_bubble_area__';
const ANOMALY_BUBBLE_HEIGHT = 6; // Height matching release bubbles

/**
 * Represents a continuous anomaly time period
 */
interface AnomalyPeriod {
  confidence: AnomalyType;
  end: number;
  start: number;
}

function anomalyTooltipFormatter(
  params: TooltipComponentFormatterCallbackParams
): string {
  const param = Array.isArray(params) ? params[0]! : params;

  const timestamp = param.value as string;
  const formattedTime = getFormattedDate(
    timestamp,
    getFormat({timeZone: true, year: true}),
    {local: true}
  );

  return [
    '<div class="tooltip-series">',
    `<span class="tooltip-label"><strong>${t('Anomaly Detected')}</strong></span>`,
    '</div>',
    `<div class="tooltip-footer">${formattedTime}</div>`,
    '<div class="tooltip-arrow"></div>',
  ].join('');
}

/**
 * Groups consecutive anomalous data points into continuous periods
 */
function groupAnomaliesIntoPeriods(
  anomalies: Anomaly[],
  timePeriodMs?: number
): AnomalyPeriod[] {
  const periods: AnomalyPeriod[] = [];
  let currentPeriod: AnomalyPeriod | null = null;

  for (const anomaly of anomalies) {
    const timestampMs = anomaly.timestamp * 1000;
    const isAnomalous = [
      AnomalyType.HIGH_CONFIDENCE,
      AnomalyType.LOW_CONFIDENCE,
    ].includes(anomaly.anomaly.anomaly_type);

    if (isAnomalous) {
      if (currentPeriod === null) {
        // Start a new anomaly period
        currentPeriod = {
          confidence: anomaly.anomaly.anomaly_type,
          end: timestampMs,
          start: timestampMs,
        };
      } else {
        // Extend the current period
        currentPeriod.end = timestampMs;
        // Use higher confidence if available
        if (anomaly.anomaly.anomaly_type === AnomalyType.HIGH_CONFIDENCE) {
          currentPeriod.confidence = AnomalyType.HIGH_CONFIDENCE;
        }
      }
    } else if (currentPeriod) {
      // End the current period and add it to results
      periods.push(currentPeriod);
      currentPeriod = null;
    }
  }

  // Handle last period if it ends with an anomaly
  if (currentPeriod) {
    periods.push(currentPeriod);
  }

  // Ensure each period spans at least 2 data points for better visualization
  if (timePeriodMs) {
    periods.forEach(period => {
      if (period.start === period.end) {
        // Extend single-point anomalies to span at least one more time period
        period.end = period.start + timePeriodMs;
      }
    });
  }

  return periods;
}

interface AnomalyBubbleSeriesProps {
  anomalyPeriods: AnomalyPeriod[];
  chartRef: React.RefObject<ReactEchartsRef | null>;
  theme: Theme;
  yAxisIndex?: number;
}

/**
 * Creates a custom series that renders anomaly highlights underneath the main chart
 */
function AnomalyBubbleSeries({
  anomalyPeriods,
  theme,
  yAxisIndex,
}: Omit<AnomalyBubbleSeriesProps, 'chartRef'>): CustomSeriesOption | null {
  if (!anomalyPeriods.length) {
    return null;
  }

  const data = anomalyPeriods.map(period => ({
    value: [period.start, 0, period.end, period.confidence],
    start: new Date(period.start).getTime(),
    end: new Date(period.end).getTime(),
    confidence: period.confidence,
  }));

  /**
   * Renders anomaly highlight rectangles underneath the main chart
   * Following the same pattern as ReleaseBubbleSeries
   */
  const renderAnomalyHighlight: CustomSeriesRenderItem = (
    params: CustomSeriesRenderItemParams,
    api: CustomSeriesRenderItemAPI
  ): CustomSeriesRenderItemReturn => {
    const dataItem = data[params.dataIndex];

    if (!dataItem) {
      return {type: 'group', children: []};
    }

    // Use the start/end timestamps to get the chart coordinates to draw the
    // rectangle. The 2nd tuple passed to `api.coord()` is always 0 because we
    // don't care about the y-coordinate as the rectangles have a static height.
    const startCoord = api.coord([dataItem.start, 0]);
    const endCoord = api.coord([dataItem.end, 0]);

    if (
      !startCoord ||
      !endCoord ||
      startCoord[0] === undefined ||
      endCoord[0] === undefined ||
      startCoord[1] === undefined
    ) {
      return {type: 'group', children: []};
    }

    const [anomalyStartX, anomalyStartY] = startCoord;
    const [anomalyEndX] = endCoord;

    // Width between two timestamps
    const width = Math.max(anomalyEndX - anomalyStartX, 2);

    // Use different colors based on confidence level - darker colors since this is binary
    const color =
      dataItem.confidence === AnomalyType.HIGH_CONFIDENCE
        ? theme.red400
        : theme.yellow400;

    const renderBubblePadding = 2; // Match release bubbles padding

    const shape = {
      // Position the rectangle in the space created by the grid/xAxis offset
      // Match release bubbles positioning exactly
      x: anomalyStartX + renderBubblePadding / 2,
      y: anomalyStartY + renderBubblePadding - 1,
      width: width - renderBubblePadding,
      height: ANOMALY_BUBBLE_HEIGHT,
      r: 0, // Match release bubbles - no border radius
    };

    return {
      type: 'rect',
      transition: ['shape'],
      shape,
      style: {
        fill: color,
        opacity: 0.9,
      },
    } satisfies CustomSeriesRenderItemReturn;
  };

  // Create mark lines for start and end of each anomaly period
  const markLineData: MarkLineComponentOption['data'] = anomalyPeriods.flatMap(period => [
    {
      xAxis: period.start,
      lineStyle: {
        color: theme.gray400,
        type: 'solid',
        width: 1,
        opacity: 0.25,
      },
      label: {
        show: false,
      },
    },
    {
      xAxis: period.end,
      lineStyle: {
        color: theme.gray400,
        type: 'solid',
        width: 1,
        opacity: 0.25,
      },
      label: {
        show: false,
      },
    },
  ]);

  return {
    id: ANOMALY_BUBBLE_SERIES_ID,
    type: 'custom',
    yAxisIndex,
    renderItem: renderAnomalyHighlight,
    name: t('Anomalies'),
    data,
    color: theme.red300,
    animation: false,
    markLine: MarkLine({
      silent: true,
      animation: false,
      data: markLineData,
    }),
    tooltip: {
      trigger: 'item',
      position: 'bottom',
      formatter: (params: any) => {
        const tooltipData = params.data;
        const startTime = getFormattedDate(
          tooltipData.start,
          getFormat({timeZone: false, year: false}),
          {local: true}
        );
        const endTime = getFormattedDate(
          tooltipData.end,
          getFormat({timeZone: true, year: false}),
          {local: true}
        );
        const confidenceLabel =
          tooltipData.confidence === AnomalyType.HIGH_CONFIDENCE
            ? t('High Confidence Anomaly')
            : t('Low Confidence Anomaly');

        return [
          '<div class="tooltip-series">',
          `<div><span class="tooltip-label"><strong>${confidenceLabel}</strong></span></div>`,
          '</div>',
          `<div class="tooltip-footer">${startTime} — ${endTime}</div>`,
          '<div class="tooltip-arrow arrow-top"></div>',
        ].join('');
      },
    },
  };
}

function getAnomalyMarkerSeries(
  anomalies: Anomaly[],
  theme: Theme,
  timePeriod?: number
): LineSeriesOption[] {
  if (!Array.isArray(anomalies) || anomalies.length === 0) {
    return [];
  }

  // Convert timePeriod from seconds to milliseconds for minimum anomaly width
  const timePeriodMs = timePeriod ? timePeriod * 1000 : undefined;
  const anomalyPeriods = groupAnomaliesIntoPeriods(anomalies, timePeriodMs);
  if (anomalyPeriods.length === 0) {
    return [];
  }

  // Create vertical line markers at the start of each anomaly period
  const anomalyStartMarkers = anomalyPeriods.map(period => ({
    xAxis: period.start,
    tooltip: {
      formatter: anomalyTooltipFormatter,
    },
  }));

  // Create shaded areas spanning the full duration of each anomaly period
  const markAreaData: MarkAreaComponentOption['data'] = anomalyPeriods.map(period => [
    {xAxis: period.start},
    {xAxis: period.end},
  ]);

  return [
    {
      name: 'Anomaly Detection',
      type: 'line',
      data: [],
      markLine: MarkLine({
        silent: false,
        lineStyle: {
          color: theme.pink300,
          type: 'dashed',
          width: 2,
        },
        label: {
          show: false,
        },
        data: anomalyStartMarkers,
        animation: false,
      }),
      markArea: MarkArea({
        silent: true,
        itemStyle: {
          color: theme.red200,
        },
        data: markAreaData,
        animation: false,
      }),
    },
  ];
}

interface UseMetricDetectorAnomalySeriesProps {
  aggregate: string;
  dataset: DetectorDataset;
  enabled: boolean;
  environment: string | undefined;
  projectId: string;
  query: string;
  sensitivity: AlertRuleSensitivity | undefined;
  series: Series[];
  statsPeriod: TimePeriod;
  thresholdType: AlertRuleThresholdType | undefined;
  timePeriod: number;
}

interface UseMetricDetectorAnomalySeriesResult {
  anomalyBubbleGrid: GridComponentOption;
  anomalyBubbleSeries: CustomSeriesOption | null;
  anomalyBubbleXAxis: any; // XAxis configuration
  anomalyBubbleYAxis: YAXisComponentOption | null;
  anomalySeries: LineSeriesOption[];
  // New bubble-based anomaly highlighting
  connectAnomalyBubbleChartRef: (ref: ReactEchartsRef | null) => void;
  error: Error | null;
  isLoading: boolean;
}

interface UseAnomalyBubblesParams {
  anomalies: Anomaly[] | undefined;
  timePeriod?: number; // Time period in seconds for minimum anomaly width
  yAxisIndex?: number;
}

interface UseAnomalyBubblesResult {
  anomalyBubbleGrid: GridComponentOption;
  anomalyBubbleSeries: CustomSeriesOption | null;
  anomalyBubbleXAxis: any; // XAxis configuration
  anomalyBubbleYAxis: YAXisComponentOption | null;
  connectAnomalyBubbleChartRef: (ref: ReactEchartsRef | null) => void;
}

/**
 * Hook for creating anomaly bubble series that renders highlights underneath the main chart
 * Following the same pattern as useReleaseBubbles
 */
export function useAnomalyBubbles({
  anomalies,
  timePeriod,
  yAxisIndex = 0,
}: UseAnomalyBubblesParams): UseAnomalyBubblesResult {
  const theme = useTheme();
  const chartRef = useRef<ReactEchartsRef | null>(null);

  const anomalyPeriods = useMemo(() => {
    if (!anomalies?.length) {
      return [];
    }
    // Convert timePeriod from seconds to milliseconds for minimum anomaly width
    const timePeriodMs = timePeriod ? timePeriod * 1000 : undefined;
    return groupAnomaliesIntoPeriods(anomalies, timePeriodMs);
  }, [anomalies, timePeriod]);

  const bubblePadding = 2; // Match release bubbles padding
  const totalBubblePaddingY = bubblePadding * 2; // 2px padding on top and bottom

  // Default X-axis configuration (when anomalies are hidden)
  const defaultBubbleXAxis = useMemo(
    () => ({
      axisLine: {onZero: true},
      offset: 0,
    }),
    []
  );

  // X-axis configuration for when anomalies are shown (moves axis down to make space)
  const anomalyBubbleXAxis = useMemo(
    () => ({
      // configure `axisLine` and `offset` to move axis line below 0 so that
      // anomalies sit between bottom of the main chart and the axis line
      axisLine: {onZero: false},
      offset: ANOMALY_BUBBLE_HEIGHT + totalBubblePaddingY - 1,
    }),
    [totalBubblePaddingY]
  );

  // Hidden Y-axis for anomaly bubbles (similar to release bubbles)
  const anomalyBubbleYAxis: YAXisComponentOption | null = useMemo(() => {
    if (!anomalyPeriods.length) {
      return null;
    }

    return {
      type: 'value' as const,
      min: 0,
      max: 100,
      show: false,
      // `axisLabel` causes an unwanted whitespace/width on the y-axis
      axisLabel: {show: false},
      // Hides an axis line + tooltip when hovering on chart
      axisPointer: {show: false},
    };
  }, [anomalyPeriods.length]);

  // Grid configuration that pushes the main chart up to make space for anomalies
  const anomalyBubbleGrid: GridComponentOption = useMemo(() => {
    if (!anomalyPeriods.length) {
      return {};
    }

    return {
      // Moves bottom of grid "up" to make space for anomaly bubbles
      // Match release bubbles: bubbleSize + totalBubblePaddingY + 1
      bottom: ANOMALY_BUBBLE_HEIGHT + totalBubblePaddingY + 1,
    };
  }, [anomalyPeriods.length, totalBubblePaddingY]);

  // Chart ref handler
  const connectAnomalyBubbleChartRef = useCallback(
    (ref: ReactEchartsRef | null) => {
      chartRef.current = ref;

      const echartsInstance = ref?.getEchartsInstance?.();

      const handleMouseOver = (params: Parameters<EChartMouseOverHandler>[0]) => {
        if (params.seriesId !== ANOMALY_BUBBLE_SERIES_ID || !echartsInstance) {
          return;
        }

        const data = params.data as any;

        // Create an empty series that has a `markArea` which highlights the
        // anomaly time period on the main chart so users can visualize the
        // time block that has the anomaly detection.
        const customSeries: CustomSeriesOption = {
          id: ANOMALY_BUBBLE_AREA_SERIES_ID,
          type: 'custom',
          renderItem: () => null,
          markArea: {
            itemStyle: {
              color:
                data.confidence === AnomalyType.HIGH_CONFIDENCE
                  ? theme.red300
                  : theme.yellow400,
              opacity: 0.2,
            },
            data: [
              [
                {
                  xAxis: data.start,
                },
                {
                  xAxis: data.end,
                },
              ],
            ],
          },
        };
        echartsInstance.setOption({series: [customSeries]}, {lazyUpdate: true});
      };

      const handleMouseOut = (params: Parameters<EChartMouseOutHandler>[0]) => {
        if (params.seriesId !== ANOMALY_BUBBLE_SERIES_ID || !echartsInstance) {
          return;
        }

        // Clear the `markArea` that was drawn during mouse over
        echartsInstance.setOption(
          {
            series: [{id: ANOMALY_BUBBLE_AREA_SERIES_ID, markArea: {data: []}}],
          },
          {
            lazyUpdate: true,
          }
        );
      };

      if (echartsInstance) {
        // Attach mouse event handlers
        echartsInstance.on('mouseover', handleMouseOver);
        echartsInstance.on('mouseout', handleMouseOut);
      }

      return () => {
        if (!echartsInstance) {
          return;
        }
        echartsInstance.off('mouseover', handleMouseOver);
        echartsInstance.off('mouseout', handleMouseOut);
      };
    },
    [theme]
  );

  const anomalyBubbleSeries = useMemo(() => {
    if (!anomalyPeriods.length) {
      return null;
    }

    return AnomalyBubbleSeries({
      anomalyPeriods,
      theme,
      yAxisIndex,
    });
  }, [anomalyPeriods, theme, yAxisIndex]);

  return {
    connectAnomalyBubbleChartRef,
    anomalyBubbleSeries,
    anomalyBubbleYAxis,
    anomalyBubbleGrid,
    // Add X-axis configuration like release bubbles
    anomalyBubbleXAxis: anomalyPeriods.length ? anomalyBubbleXAxis : defaultBubbleXAxis,
  };
}

/**
 * Example usage:
 *
 * const {
 *   anomalySeries, // Legacy overlay series (can be ignored if using bubbles)
 *   connectAnomalyBubbleChartRef,
 *   anomalyBubbleSeries,
 *   anomalyBubbleXAxis,
 *   anomalyBubbleYAxis,
 *   anomalyBubbleGrid,
 * } = useMetricDetectorAnomalySeries({...});
 *
 * // In your chart component:
 * const yAxes = [mainYAxis];
 * if (anomalyBubbleYAxis) {
 *   yAxes.push(anomalyBubbleYAxis);
 * }
 *
 * const series = [...mainSeries];
 * if (anomalyBubbleSeries) {
 *   series.push(anomalyBubbleSeries);
 * }
 *
 * <AreaChart
 *   ref={connectAnomalyBubbleChartRef}
 *   yAxes={yAxes.length > 1 ? yAxes : undefined}
 *   yAxis={yAxes.length === 1 ? yAxes[0] : undefined}
 *   xAxis={anomalyBubbleXAxis}
 *   grid={{...defaultGrid, ...anomalyBubbleGrid}}
 *   additionalSeries={[anomalyBubbleSeries]}
 * />
 */
export function useMetricDetectorAnomalySeries({
  series,
  dataset,
  aggregate,
  query,
  environment,
  projectId,
  statsPeriod,
  timePeriod,
  thresholdType,
  sensitivity,
  enabled,
}: UseMetricDetectorAnomalySeriesProps): UseMetricDetectorAnomalySeriesResult {
  const theme = useTheme();

  // Fetch historical data with extended time period for anomaly detection baseline comparison
  const isFiveMinuteTimePeriod = timePeriod === 300;
  const historicalPeriod = isFiveMinuteTimePeriod
    ? HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS[
        statsPeriod as keyof typeof HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS
      ]
    : HISTORICAL_TIME_PERIOD_MAP[statsPeriod as keyof typeof HISTORICAL_TIME_PERIOD_MAP];

  const {series: historicalSeries, isLoading: isHistoricalLoading} =
    useMetricDetectorSeries({
      dataset,
      aggregate,
      interval: timePeriod,
      query,
      environment,
      projectId,
      statsPeriod: historicalPeriod as TimePeriod,
      options: {
        enabled,
      },
    });

  const {
    data: anomalies,
    isLoading,
    error,
  } = useMetricDetectorAnomalies({
    series,
    historicalSeries,
    projectId,
    thresholdType,
    sensitivity,
    timePeriod,
    enabled,
  });
  const anomalySeries = useMemo<LineSeriesOption[]>(() => {
    if (!anomalies || anomalies.length === 0 || isHistoricalLoading || isLoading) {
      return [];
    }
    return getAnomalyMarkerSeries(anomalies, theme, timePeriod);
  }, [anomalies, theme, timePeriod, isHistoricalLoading, isLoading]);

  // Use the new bubble system for anomaly highlighting
  const {
    connectAnomalyBubbleChartRef,
    anomalyBubbleSeries,
    anomalyBubbleXAxis,
    anomalyBubbleYAxis,
    anomalyBubbleGrid,
  } = useAnomalyBubbles({
    anomalies,
    timePeriod, // Pass time period for minimum anomaly width
    yAxisIndex: 1, // Use index 1 to avoid conflict with main chart axis
  });

  return {
    anomalySeries,
    isLoading: isHistoricalLoading || isLoading,
    error,
    // New bubble-based anomaly highlighting
    connectAnomalyBubbleChartRef,
    anomalyBubbleSeries,
    anomalyBubbleXAxis,
    anomalyBubbleYAxis,
    anomalyBubbleGrid,
  };
}
