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
  MarkLineComponentOption,
  TooltipComponentFormatterCallbackParams,
  YAXisComponentOption,
} from 'echarts';

import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import type {
  EChartMouseOutHandler,
  EChartMouseOverHandler,
  ReactEchartsRef,
} from 'sentry/types/echarts';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';

const INCIDENT_BUBBLE_SERIES_ID = '__incident_bubble__';
const INCIDENT_BUBBLE_AREA_SERIES_ID = '__incident_bubble_area__';
const INCIDENT_BUBBLE_HEIGHT = 6; // Height matching release bubbles

/**
 * Represents a generic incident/event time period
 */
export interface IncidentPeriod {
  /**
   * Color for the bubble
   */
  color: string;
  /**
   * End timestamp in milliseconds
   */
  end: number;
  /**
   * Display name for the incident
   */
  name: string;
  /**
   * Start timestamp in milliseconds
   */
  start: number;
  /**
   * Type identifier for the incident
   */
  type: string;
  /**
   * Color for hover state (optional)
   */
  hoverColor?: string;
}

function incidentTooltipFormatter(params: TooltipComponentFormatterCallbackParams) {
  const data = (Array.isArray(params) ? params[0]?.data : params.data) as
    | IncidentPeriod
    | undefined;

  if (!data) {
    return '';
  }

  const startTime = getFormattedDate(
    data.start,
    getFormat({timeZone: false, year: false}),
    {local: true}
  );

  const endTime = getFormattedDate(data.end, getFormat({timeZone: true, year: false}), {
    local: true,
  });

  return [
    '<div class="tooltip-series">',
    `<div><span class="tooltip-label"><strong>${data.name}</strong></span></div>`,
    '</div>',
    `<div class="tooltip-footer">${startTime} — ${endTime}</div>`,
    '<div class="tooltip-arrow arrow-top"></div>',
  ].join('');
}

interface IncidentBubbleSeriesProps {
  incidentPeriods: IncidentPeriod[];
  theme: Theme;
  seriesId?: string;
  seriesName?: string;
  yAxisIndex?: number;
}

/**
 * Creates a custom series that renders incident highlights underneath the main chart
 */
function IncidentBubbleSeries({
  incidentPeriods,
  theme,
  yAxisIndex,
  seriesName = t('Incidents'),
  seriesId = INCIDENT_BUBBLE_SERIES_ID,
}: IncidentBubbleSeriesProps): CustomSeriesOption | null {
  if (!incidentPeriods.length) {
    return null;
  }

  const data = incidentPeriods.map(period => ({
    value: [period.start, 0, period.end, period.type],
    start: new Date(period.start).getTime(),
    end: new Date(period.end).getTime(),
    type: period.type,
    name: period.name,
    color: period.color,
    hoverColor: period.hoverColor || period.color,
  }));

  /**
   * Renders incident highlight rectangles underneath the main chart
   * Following the same pattern as ReleaseBubbleSeries
   */
  const renderIncidentHighlight: CustomSeriesRenderItem = (
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

    const [incidentStartX, incidentStartY] = startCoord;
    const [incidentEndX] = endCoord;

    // Width between two timestamps
    const width = Math.max(incidentEndX - incidentStartX, 2);

    const renderBubblePadding = 2; // Match release bubbles padding

    const shape = {
      // Position the rectangle in the space created by the grid/xAxis offset
      // Match release bubbles positioning exactly
      x: incidentStartX + renderBubblePadding / 2,
      y: incidentStartY + renderBubblePadding - 1,
      width: width - renderBubblePadding,
      height: INCIDENT_BUBBLE_HEIGHT,
      r: 0, // Match release bubbles - no border radius
    };

    return {
      type: 'rect',
      transition: ['shape'],
      shape,
      style: {
        fill: dataItem.color,
        opacity: 0.9,
      },
    };
  };

  // Create mark lines for start and end of each incident period
  const markLineData: MarkLineComponentOption['data'] = incidentPeriods.flatMap(
    period => [
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
    ]
  );

  return {
    id: seriesId,
    type: 'custom',
    yAxisIndex,
    renderItem: renderIncidentHighlight,
    name: seriesName,
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
      formatter: incidentTooltipFormatter,
    },
  };
}

interface UseIncidentBubblesProps {
  incidents?: IncidentPeriod[];
  seriesId?: string;
  seriesName?: string;
  yAxisIndex?: number;
}

interface UseIncidentBubblesResult {
  connectIncidentBubbleChartRef: (ref: ReactEchartsRef | null) => void;
  incidentBubbleGrid: GridComponentOption;
  incidentBubbleSeries: CustomSeriesOption | null;
  incidentBubbleXAxis: {
    axisLine: {onZero: boolean};
    offset: number;
  };
  incidentBubbleYAxis: YAXisComponentOption | null;
}

/**
 * Takes an array of incidents and returns a series that renders them as bubbles
 */
export function useIncidentBubbles({
  incidents,
  yAxisIndex = 0,
  seriesName = t('Incidents'),
  seriesId = INCIDENT_BUBBLE_SERIES_ID,
}: UseIncidentBubblesProps): UseIncidentBubblesResult {
  const theme = useTheme();
  const chartRef = useRef<ReactEchartsRef | null>(null);

  const incidentPeriods = useMemo(() => incidents || [], [incidents]);

  const bubblePadding = 2; // Match release bubbles padding
  const totalBubblePaddingY = bubblePadding * 2; // 2px padding on top and bottom

  // Default X-axis configuration (when incidents are hidden)
  const defaultBubbleXAxis = useMemo(
    () => ({
      axisLine: {onZero: true},
      offset: 0,
    }),
    []
  );

  // X-axis configuration for when incidents are shown (moves axis down to make space)
  const incidentBubbleXAxis = useMemo(
    () => ({
      // configure `axisLine` and `offset` to move axis line below 0 so that
      // incidents sit between bottom of the main chart and the axis line
      axisLine: {onZero: false},
      offset: INCIDENT_BUBBLE_HEIGHT + totalBubblePaddingY - 1,
    }),
    [totalBubblePaddingY]
  );

  // Hidden Y-axis for incident bubbles (similar to release bubbles)
  const incidentBubbleYAxis: YAXisComponentOption | null = useMemo(() => {
    if (!incidentPeriods.length) {
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
  }, [incidentPeriods.length]);

  // Grid configuration that pushes the main chart up to make space for incidents
  const incidentBubbleGrid: GridComponentOption = useMemo(() => {
    if (!incidentPeriods.length) {
      return {};
    }

    return {
      // Moves bottom of grid "up" to make space for incident bubbles
      // Match release bubbles: bubbleSize + totalBubblePaddingY + 1
      bottom: INCIDENT_BUBBLE_HEIGHT + totalBubblePaddingY + 1,
    };
  }, [incidentPeriods.length, totalBubblePaddingY]);

  // Chart ref handler
  const connectIncidentBubbleChartRef = useCallback(
    (ref: ReactEchartsRef | null) => {
      chartRef.current = ref;

      const echartsInstance = ref?.getEchartsInstance?.();

      const handleMouseOver = (params: Parameters<EChartMouseOverHandler>[0]) => {
        if (params.seriesId !== seriesId || !echartsInstance) {
          return;
        }

        const data = params.data as IncidentPeriod;

        // Create an empty series that has a `markArea` which highlights the
        // incident time period on the main chart so users can visualize the
        // time block that has the incident.
        const customSeries: CustomSeriesOption = {
          id: INCIDENT_BUBBLE_AREA_SERIES_ID,
          type: 'custom',
          renderItem: () => null,
          markArea: {
            itemStyle: {
              color: data.hoverColor,
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
        if (params.seriesId !== seriesId || !echartsInstance) {
          return;
        }

        // Clear the `markArea` that was drawn during mouse over
        echartsInstance.setOption(
          {
            series: [{id: INCIDENT_BUBBLE_AREA_SERIES_ID, markArea: {data: []}}],
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
    [seriesId]
  );

  const incidentBubbleSeries = useMemo(() => {
    if (!incidentPeriods.length) {
      return null;
    }

    return IncidentBubbleSeries({
      incidentPeriods,
      theme,
      yAxisIndex,
      seriesName,
      seriesId,
    });
  }, [incidentPeriods, theme, yAxisIndex, seriesName, seriesId]);

  return {
    connectIncidentBubbleChartRef,
    incidentBubbleSeries,
    incidentBubbleYAxis,
    incidentBubbleGrid,
    incidentBubbleXAxis: incidentPeriods.length
      ? incidentBubbleXAxis
      : defaultBubbleXAxis,
  };
}
