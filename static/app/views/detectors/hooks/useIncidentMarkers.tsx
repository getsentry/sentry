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
  EChartChartReadyHandler,
  EChartClickHandler,
  EChartMouseOutHandler,
  EChartMouseOverHandler,
  ECharts,
} from 'sentry/types/echarts';

const INCIDENT_MARKER_SERIES_ID = '__incident_marker__';
const INCIDENT_MARKER_AREA_SERIES_ID = '__incident_marker_area__';
const INCIDENT_MARKER_HEIGHT = 6;

// Default X-axis configuration (when incidents are hidden)
const DEFAULT_INCIDENT_MARKER_X_AXIS_CONFIG = {
  axisLine: {onZero: true},
  offset: 0,
};

/**
 * Represents a generic incident/event time period
 */
export interface IncidentPeriod {
  /**
   * End timestamp in milliseconds
   */
  end: number;
  /**
   * Unique identifier for the incident/event
   */
  id: string;
  /**
   * Priority of the incident/event
   */
  priority: 'high' | 'medium';
  /**
   * Start timestamp in milliseconds
   */
  start: number;
  /**
   * Type of the incident/event. This determines how the marker is rendered.
   * - `trigger-interval`: A marker for the duration of the interval before the beginning of an open period.
   * - `open-period-start`: A marker for the start of an open period.
   * - `open-period-transition`: Used for priority transitions within an open period.
   */
  type: 'trigger-interval' | 'open-period-start' | 'open-period-transition';
}

interface IncidentMarkerSeriesProps {
  incidentPeriods: IncidentPeriod[];
  markLineTooltip: UseIncidentMarkersProps['markLineTooltip'];
  seriesId: string;
  seriesName: string;
  seriesTooltip: UseIncidentMarkersProps['seriesTooltip'];
  theme: Theme;
  yAxisIndex: number;
}

const makeStripeBackgroundSvgNode = (color: string) => {
  return {
    key: 'stripe-background',
    tag: 'svg',
    attrs: {
      width: '2',
      height: `${INCIDENT_MARKER_HEIGHT}`,
      viewBox: `0 0 2 ${INCIDENT_MARKER_HEIGHT}`,
      shapeRendering: 'crispEdges',
    },
    children: [
      {
        key: 'stripe-background-line',
        tag: 'rect',
        attrs: {
          x: '0',
          y: '0',
          width: '1',
          height: `${INCIDENT_MARKER_HEIGHT}`,
          fill: color,
        },
      },
    ],
  };
};

const getPriorityColor = ({
  priority,
  theme,
}: {
  priority: 'high' | 'medium';
  theme: Theme;
}) => {
  return priority === 'medium' ? theme.colors.yellow400 : theme.colors.red400;
};

/**
 * Creates a custom series that renders incident highlights underneath the main chart
 */
function IncidentMarkerSeries({
  incidentPeriods,
  theme,
  seriesId,
  seriesName,
  yAxisIndex,
  seriesTooltip,
  markLineTooltip,
}: IncidentMarkerSeriesProps): CustomSeriesOption | null {
  if (!incidentPeriods.length) {
    return null;
  }

  /**
   * Renders incident highlight rectangles underneath the main chart
   */
  const renderIncidentHighlight: CustomSeriesRenderItem = (
    params: CustomSeriesRenderItemParams,
    api: CustomSeriesRenderItemAPI
  ): CustomSeriesRenderItemReturn => {
    const dataItem = incidentPeriods[params.dataIndex];

    if (!dataItem) {
      return {type: 'group', children: []};
    }

    const allItemsWithinPeriod = incidentPeriods
      .filter(period => period.id === dataItem?.id)
      .toSorted((a, b) => a.start - b.start);
    const isLastItem =
      allItemsWithinPeriod.indexOf(dataItem) === allItemsWithinPeriod.length - 1;

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

    const renderMarkerPadding = 2;

    const shape = {
      // Position the rectangle in the space created by the grid/xAxis offset
      x: incidentStartX,
      y: incidentStartY + renderMarkerPadding - 1,
      width,
      height: INCIDENT_MARKER_HEIGHT,
      r:
        dataItem.type === 'trigger-interval'
          ? [2, 0, 0, 2]
          : isLastItem
            ? [0, 2, 2, 0]
            : [0, 0, 0, 0],
    };

    const color = getPriorityColor({
      priority: dataItem.priority,
      theme,
    });

    return {
      type: 'rect',
      transition: ['shape'],
      shape,
      style: {
        fill:
          dataItem.type === 'trigger-interval'
            ? {
                svgElement: makeStripeBackgroundSvgNode(color),
                svgWidth: 2,
                svgHeight: INCIDENT_MARKER_HEIGHT,
              }
            : color,
        opacity: 1,
      },
    };
  };

  // Create mark lines for the start of each incident period
  const markLineData: MarkLineComponentOption['data'] = incidentPeriods
    .filter(period => period.type === 'open-period-start')
    .map(data => {
      const color = getPriorityColor({
        priority: data.priority,
        theme,
      });

      const lineStyle: MarkLineComponentOption['lineStyle'] = {
        color,
        type: 'solid',
        width: 1,
        opacity: 0.8,
      };

      return {
        xAxis: data.start,
        lineStyle,
        emphasis: {
          lineStyle: {
            ...lineStyle,
            width: 2,
            opacity: 1,
          },
        },
        label: {
          show: false,
        },
        tooltip: {
          trigger: 'item',
          position: 'bottom',
          formatter: markLineTooltip
            ? () => {
                return markLineTooltip({
                  theme,
                  period: data,
                });
              }
            : undefined,
        },
      };
    });

  return {
    id: seriesId ?? INCIDENT_MARKER_SERIES_ID,
    name: seriesName ?? t('Incidents'),
    type: 'custom',
    yAxisIndex,
    renderItem: renderIncidentHighlight,
    data: incidentPeriods,
    color: theme.colors.red400,
    animation: false,
    markLine: MarkLine({
      silent: false,
      animation: false,
      data: markLineData,
    }),
    tooltip: seriesTooltip
      ? {
          trigger: 'item',
          position: 'bottom',
          formatter: (p: TooltipComponentFormatterCallbackParams) => {
            const datum = (Array.isArray(p) ? p[0]?.data : p.data) as
              | IncidentPeriod
              | undefined;
            return datum ? seriesTooltip({theme, period: datum}) : '';
          },
        }
      : undefined,
  };
}

interface UseIncidentMarkersProps {
  incidents: IncidentPeriod[];
  seriesName: string;
  /**
   * Provide a custom tooltip for the mark line items
   */
  markLineTooltip?: (context: {period: IncidentPeriod; theme: Theme}) => string;
  onClick?: (context: {item: 'line' | 'bubble'; period: IncidentPeriod}) => void;
  seriesId?: string;
  /**
   * Provide a custom tooltip for the series
   */
  seriesTooltip?: (context: {period: IncidentPeriod; theme: Theme}) => string;
  yAxisIndex?: number;
}

interface UseIncidentMarkersResult {
  incidentMarkerGrid: GridComponentOption;
  incidentMarkerSeries: CustomSeriesOption | null;
  incidentMarkerXAxis: {
    axisLine: {onZero: boolean};
    offset: number;
  };
  incidentMarkerYAxis: YAXisComponentOption | null;
  onChartReady: EChartChartReadyHandler;
}

/**
 * Takes an array of incidents and returns a series that renders them as bubbles
 */
export function useIncidentMarkers({
  incidents,
  seriesId = INCIDENT_MARKER_SERIES_ID,
  seriesName,
  seriesTooltip,
  markLineTooltip,
  yAxisIndex = 0,
  onClick,
}: UseIncidentMarkersProps): UseIncidentMarkersResult {
  const theme = useTheme();
  const chartRef = useRef<ECharts | null>(null);

  const incidentPeriods = useMemo(() => incidents || [], [incidents]);

  const markerPadding = 2;
  const totalMarkerPaddingY = markerPadding * 2; // 2px padding on top and bottom

  // X-axis configuration for when incidents are shown (moves axis down to make space)
  const incidentMarkerXAxis = useMemo(
    () => ({
      // configure `axisLine` and `offset` to move axis line below 0 so that
      // incidents sit between bottom of the main chart and the axis line
      axisLine: {onZero: false},
      offset: INCIDENT_MARKER_HEIGHT + totalMarkerPaddingY - 1,
    }),
    [totalMarkerPaddingY]
  );

  // Hidden Y-axis for incident bubbles
  const incidentMarkerYAxis: YAXisComponentOption | null = useMemo(() => {
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
  const incidentMarkerGrid = useMemo<GridComponentOption>(() => {
    if (!incidentPeriods.length) {
      return {};
    }

    return {
      // Moves bottom of grid "up" to make space for incident bubbles
      bottom: INCIDENT_MARKER_HEIGHT + totalMarkerPaddingY + 2,
    };
  }, [incidentPeriods.length, totalMarkerPaddingY]);

  // Chart ref handler
  const onChartReady = useCallback<EChartChartReadyHandler>(
    echartsInstance => {
      chartRef.current = echartsInstance;

      // Map incident start timestamps to periods for quick lookup on markLine clicks
      const periodByStart = new Map<number, IncidentPeriod>();
      for (const period of incidentPeriods) {
        periodByStart.set(period.start, period);
      }

      const handleMouseOver = (params: Parameters<EChartMouseOverHandler>[0]) => {
        if (
          params.seriesId !== seriesId ||
          !echartsInstance ||
          params.componentType !== 'series'
        ) {
          return;
        }

        const data = params.data as IncidentPeriod;

        // Create an empty series that has a `markArea` which highlights the
        // incident time period on the main chart so users can visualize the
        // time block that has the incident.
        const customSeries: CustomSeriesOption = {
          id: INCIDENT_MARKER_AREA_SERIES_ID,
          type: 'custom',
          renderItem: () => null,
          markArea: {
            itemStyle: {
              color: getPriorityColor({
                priority: data.priority,
                theme,
              }),
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
        if (
          params.seriesId !== seriesId ||
          !echartsInstance ||
          params.componentType !== 'series'
        ) {
          return;
        }

        // Clear the `markArea` that was drawn during mouse over
        echartsInstance.setOption(
          {
            series: [{id: INCIDENT_MARKER_AREA_SERIES_ID, markArea: {data: []}}],
          },
          {
            lazyUpdate: true,
          }
        );
      };

      const handleClick = (params: Parameters<EChartClickHandler>[0]) => {
        if (!echartsInstance || !onClick) {
          return;
        }

        // Click on the incident rectangle ("bubble")
        if (params.componentType === 'series' && params.seriesId === seriesId) {
          const datum = params.data as IncidentPeriod;
          if (datum) {
            onClick({item: 'bubble', period: datum});
          }
          return;
        }

        // Click on the incident start markLine
        if (params.componentType === 'markLine' && params.seriesId === seriesId) {
          type MarkLineDatum = {xAxis?: number};
          const datum = params.data as MarkLineDatum;
          const start = typeof datum?.xAxis === 'number' ? datum.xAxis : undefined;
          const period = start === undefined ? undefined : periodByStart.get(start);
          if (period) {
            onClick({item: 'line', period});
          }
        }
      };

      if (echartsInstance) {
        // @ts-expect-error not sure what type echarts is expecting here
        echartsInstance.on('mouseover', handleMouseOver);
        // @ts-expect-error not sure what type echarts is expecting here
        echartsInstance.on('mouseout', handleMouseOut);
        // @ts-expect-error not sure what type echarts is expecting here
        echartsInstance.on('click', handleClick);
      }

      return () => {
        if (!echartsInstance) {
          return;
        }
        echartsInstance.off('mouseover', handleMouseOver);
        echartsInstance.off('mouseout', handleMouseOut);
        echartsInstance.off('click', handleClick);
      };
    },
    [incidentPeriods, seriesId, theme, onClick]
  );

  const incidentMarkerSeries = useMemo(() => {
    if (!incidentPeriods.length) {
      return null;
    }

    return IncidentMarkerSeries({
      incidentPeriods,
      theme,
      yAxisIndex,
      seriesName,
      seriesId,
      seriesTooltip,
      markLineTooltip,
    });
  }, [
    incidentPeriods,
    theme,
    yAxisIndex,
    seriesName,
    seriesId,
    seriesTooltip,
    markLineTooltip,
  ]);

  return {
    onChartReady,
    incidentMarkerSeries,
    incidentMarkerYAxis,
    incidentMarkerGrid,
    incidentMarkerXAxis: incidentPeriods.length
      ? incidentMarkerXAxis
      : DEFAULT_INCIDENT_MARKER_X_AXIS_CONFIG,
  };
}
