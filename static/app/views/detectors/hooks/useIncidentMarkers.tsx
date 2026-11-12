import {useCallback, useEffect, useMemo, useRef} from 'react';
import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import type {
  CustomSeriesOption,
  CustomSeriesRenderItem,
  ECElementEvent,
  GridComponentOption,
  MarkLineComponentOption,
  TooltipComponentFormatterCallbackParams,
  YAXisComponentOption,
} from 'echarts';

import {markLine} from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import type {EChartChartReadyHandler, ECharts} from 'sentry/types/echarts';

const INCIDENT_MARKER_SERIES_ID = '__incident_marker__';
const INCIDENT_MARKER_PERSISTENT_AREA_SERIES_ID = '__incident_marker_area_persistent__';
const INCIDENT_MARKER_HEIGHT = 6;
const INCIDENT_MARKER_PADDING = 2;
const INCIDENT_MARKER_PADDING_Y = INCIDENT_MARKER_PADDING * 2;

// You need to set the z2 property manually or the wide "threshold breached" intervals
// will mask the open periods next to them on hover
const EMPHASIS_Z2 = 0;

// Default X-axis configuration (when incidents are hidden)
const DEFAULT_INCIDENT_MARKER_X_AXIS_CONFIG = {
  axisLine: {onZero: true},
  offset: 0,
};

// If incidents are shown you need to move the axis down to make space for them
const INCIDENT_MARKER_X_AXIS_CONFIG = {
  axisLine: {onZero: false},
  offset: INCIDENT_MARKER_HEIGHT + INCIDENT_MARKER_PADDING_Y - 1,
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
  /**
   * Whether the incident is still open, in which case `end` is the end of the chart
   */
  isOngoing?: boolean;
  /**
   * Short ID of the issue the incident belongs to, e.g. `PROJECT-1A`
   */
  issueShortId?: string | null;
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

function findClickedIncidentPeriod(
  params: ECElementEvent,
  incidentPeriods: IncidentPeriod[]
): IncidentPeriod | undefined {
  if (params.componentType === 'series') {
    return params.data as IncidentPeriod | undefined;
  }

  if (params.componentType === 'markLine') {
    const markLineDatum = params.data as {xAxis?: number} | undefined;

    // Use findLast to handle overlapping incidents properly
    return incidentPeriods.findLast(period => period.start === markLineDatum?.xAxis);
  }

  return undefined;
}

/**
 * Creates a custom series that renders incident highlights underneath the main chart
 */
function createIncidentMarkerSeries({
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
  const renderIncidentHighlight: CustomSeriesRenderItem = (params, api) => {
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

    // ECharts provides coordinate system boundaries via params.coordSys
    // https://echarts.apache.org/en/option.html#series-custom.renderItem.arguments.params
    const coordSys = params.coordSys as any;
    const chartLeft = coordSys.x ?? 0;
    const chartRight = (coordSys.x ?? 0) + (coordSys.width ?? 0);

    // Clip bubble coordinates to stay within visible chart area
    // This prevents overflow when incidents start before or extend past the visible time range
    const clippedStartX = Math.max(incidentStartX, chartLeft);
    const clippedEndX = Math.min(incidentEndX, chartRight);

    // Width between two timestamps, adjusted for clipping
    const width = Math.max(clippedEndX - clippedStartX, 2);

    const shape = {
      // Position the rectangle using clipped coordinates to prevent overflow
      x: clippedStartX,
      y: incidentStartY + INCIDENT_MARKER_PADDING - 1,
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
      type: 'group',
      children: [
        {
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
          emphasis: {z2: EMPHASIS_Z2},
        },
        // Enable viewing incidents by hovering anywhere over their time period on the chart
        // Hovering puts this in the emphasis state, making it become visible
        {
          type: 'rect',
          tooltipDisabled: true,
          shape: {
            x: clippedStartX,
            y: coordSys.y ?? 0,
            width: Math.max(clippedEndX - clippedStartX, 0),
            height: coordSys.height ?? 0,
          },
          style: {fill: color, opacity: 0},
          emphasis: {z2: EMPHASIS_Z2, style: {fill: color, opacity: 0.2}},
        },
      ],
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
    markLine: markLine({
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
  highlightedIncidentId?: string;
  markLineTooltip?: (context: {period: IncidentPeriod; theme: Theme}) => string;
  onClick?: (context: {period: IncidentPeriod}) => void;
  seriesId?: string;
  /**
   * Provide a custom tooltip for the series
   */
  seriesTooltip?: (context: {period: IncidentPeriod; theme: Theme}) => string;
  yAxisIndex?: number;
}

interface UseIncidentMarkersResult {
  highlightedIncidentAreaSeries: CustomSeriesOption | null;
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
  highlightedIncidentId,
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

  // since onChartReady only runs one time when its created, its handler functions
  // need to read these refs to avoid calling a stale onClick and reading stale incidentPeriods
  const latestIncidentPeriodsRef = useRef(incidentPeriods);

  const latestOnClickRef = useRef(onClick);

  useEffect(() => {
    latestIncidentPeriodsRef.current = incidentPeriods;

    latestOnClickRef.current = onClick;
  }, [incidentPeriods, onClick]);

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
      bottom: INCIDENT_MARKER_HEIGHT + INCIDENT_MARKER_PADDING_Y + 2,
    };
  }, [incidentPeriods.length]);

  // Chart ref handler
  const onChartReady = useCallback<EChartChartReadyHandler>(
    echartsInstance => {
      chartRef.current = echartsInstance;

      const zr = echartsInstance.getZr();

      const handleClick = (params: ECElementEvent) => {
        if (params.seriesId !== seriesId) {
          return;
        }

        const clickedIncidentPeriod = findClickedIncidentPeriod(
          params,
          latestIncidentPeriodsRef.current
        );

        if (clickedIncidentPeriod) {
          latestOnClickRef.current?.({period: clickedIncidentPeriod});
        }
      };

      // Manually set the cursor to pointer when hovering over an incident marker
      // to indicate it is a clickable link
      const handleMouseMove = (params: ECElementEvent) => {
        if (params.seriesId !== seriesId || !latestOnClickRef.current) {
          return;
        }

        queueMicrotask(() => zr.setCursorStyle('pointer'));
      };

      echartsInstance.on('click', handleClick);
      echartsInstance.on('mousemove', handleMouseMove);

      return () => {
        echartsInstance.off('click', handleClick);
        echartsInstance.off('mousemove', handleMouseMove);
      };
    },
    [seriesId]
  );

  const incidentMarkerSeries = useMemo(() => {
    if (!incidentPeriods.length) {
      return null;
    }

    return createIncidentMarkerSeries({
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

  const highlightedIncidentAreaSeries = useMemo<CustomSeriesOption | null>(() => {
    if (!highlightedIncidentId || !incidentPeriods.length) {
      return null;
    }

    const highlightedPeriods = incidentPeriods.filter(
      period => period.id === highlightedIncidentId && period.type !== 'trigger-interval'
    );

    if (!highlightedPeriods.length) {
      return null;
    }

    return {
      id: INCIDENT_MARKER_PERSISTENT_AREA_SERIES_ID,
      type: 'custom',
      renderItem: () => null,
      silent: true,
      markArea: {
        data: highlightedPeriods.map(period => {
          const color = getPriorityColor({priority: period.priority, theme});
          return [
            {
              xAxis: period.start,
              itemStyle: {
                color,
                opacity: 0.2,
              },
            },
            {xAxis: period.end},
          ];
        }),
      },
    };
  }, [highlightedIncidentId, incidentPeriods, theme]);

  return {
    onChartReady,
    incidentMarkerSeries,
    incidentMarkerYAxis,
    incidentMarkerGrid,
    incidentMarkerXAxis: incidentPeriods.length
      ? INCIDENT_MARKER_X_AXIS_CONFIG
      : DEFAULT_INCIDENT_MARKER_X_AXIS_CONFIG,
    highlightedIncidentAreaSeries,
  };
}
