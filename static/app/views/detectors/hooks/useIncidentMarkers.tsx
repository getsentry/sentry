import {useCallback, useEffect, useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import type {
  CustomSeriesOption,
  ECElementEvent,
  GridComponentOption,
  YAXisComponentOption,
} from 'echarts';

import type {EChartChartReadyHandler, ECharts} from 'sentry/types/echarts';
import {
  createIncidentMarkerSeries,
  DEFAULT_INCIDENT_MARKER_X_AXIS_CONFIG,
  getPriorityColor,
  INCIDENT_MARKER_GRID,
  INCIDENT_MARKER_SERIES_ID,
  INCIDENT_MARKER_X_AXIS_CONFIG,
  INCIDENT_MARKER_Y_AXIS,
  type IncidentMarkerTooltip,
  type IncidentPeriod,
} from 'sentry/views/detectors/utils/incidentMarkers';

const INCIDENT_MARKER_PERSISTENT_AREA_SERIES_ID = '__incident_marker_area_persistent__';

const EMPTY_GRID: GridComponentOption = {};

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

interface UseIncidentMarkersProps {
  incidents: IncidentPeriod[];
  seriesName: string;
  /**
   * Provide a custom tooltip for the mark line items
   */
  highlightedIncidentId?: string;
  markLineTooltip?: IncidentMarkerTooltip;
  onClick?: (context: {period: IncidentPeriod}) => void;
  seriesId?: string;
  /**
   * Provide a custom tooltip for the series
   */
  seriesTooltip?: IncidentMarkerTooltip;
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

  const hasIncidentPeriods = incidentPeriods.length > 0;

  const incidentMarkerYAxis = hasIncidentPeriods ? INCIDENT_MARKER_Y_AXIS : null;

  // Grid configuration that pushes the main chart up to make space for incidents
  const incidentMarkerGrid = hasIncidentPeriods ? INCIDENT_MARKER_GRID : EMPTY_GRID;

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
    incidentMarkerXAxis: hasIncidentPeriods
      ? INCIDENT_MARKER_X_AXIS_CONFIG
      : DEFAULT_INCIDENT_MARKER_X_AXIS_CONFIG,
    highlightedIncidentAreaSeries,
  };
}
