import {useCallback, useEffect, useMemo, useReducer, useState} from 'react';
import type {BrushComponentOption, EChartsOption, ToolboxComponentOption} from 'echarts';
import * as echarts from 'echarts';
import type EChartsReact from 'echarts-for-react';

import ToolBox from 'sentry/components/charts/components/toolBox';
import type {
  EchartBrushAreas,
  EChartBrushEndHandler,
  EChartBrushStartHandler,
} from 'sentry/types/echarts';
import useOrganization from 'sentry/utils/useOrganization';
import {useWidgetSyncContext} from 'sentry/views/dashboards/contexts/widgetSyncContext';

type Props = {
  chartRef: React.RefObject<EChartsReact | null>;
  chartWrapperRef: React.RefObject<HTMLDivElement | null>;
  triggerWrapperRef: React.RefObject<HTMLDivElement | null>;
};

export type BoxSelectOptions = {
  boxCoordRange: {
    x: [number, number];
    y: [number, number];
  } | null;
  brush: EChartsOption['brush'];
  clearSelection: () => void;
  floatingTriggerPosition: {left: number; top: number} | null;
  onBrushEnd: EChartBrushEndHandler;
  onBrushStart: EChartBrushStartHandler;
  reActivateSelection: () => void;
  toolBox: ToolboxComponentOption | undefined;
};

export const EXPLORE_CHART_BRUSH_OPTION: BrushComponentOption = {
  mainType: 'brush',
  toolbox: ['rect', 'clear'],
  brushMode: 'single',
  throttleType: 'debounce',
  throttleDelay: 100,
  xAxisIndex: 0,
  yAxisIndex: 0,
  brushStyle: {},
  removeOnClick: false,
  transformable: true,
};

export function useChartBoxSelect({
  chartRef,
  chartWrapperRef,
  triggerWrapperRef,
}: Props): BoxSelectOptions {
  const organization = useOrganization();

  const {groupName} = useWidgetSyncContext();

  const enabledBoxSelect = organization.features.includes(
    'performance-spans-suspect-attributes'
  );

  // This contains the coordinate range of the selected area, that we expose to the parent component.
  // It is clamped to extremes of the chart's x and y axes.
  const [brushArea, setBrushArea] = useState<EchartBrushAreas | null>(null);

  // This exposes the page coordinates when the user finishes drawing the box. This is used
  // to render floating CTAs on top of the chart.
  const [floatingTriggerPosition, setFloatingTriggerPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);

  // This increments a counter to force a re-activation of the brush mode. We expose the
  // re-activation function in the return value, so that the parent component can call it
  // for example when the chart data changes.
  const [forceReActivateSelection, reActivateSelection] = useReducer(
    x => (x + 1) % Number.MAX_SAFE_INTEGER,
    0
  );

  const onBrushStart = useCallback<EChartBrushStartHandler>(() => {
    // Echarts either lets us connect all interactivity of the charts in a group or none of them.
    // We need connectivity for cursor syncing, but having that enabled while drawing, leads to a
    // box drawn for all of the charts in the group. We are going for chart specific box selections,
    // so we disconnect the group while drawing.
    echarts?.disconnect(groupName);
  }, [groupName]);

  const onBrushEnd = useCallback<EChartBrushEndHandler>(
    (evt: any, chart: any) => {
      if (!chartRef.current) return;

      const xAxis = chart.getModel().getComponent('xAxis', 0);
      const yAxis = chart.getModel().getComponent('yAxis', 0);

      const xMin = xAxis.axis.scale.getExtent()[0];
      const xMax = xAxis.axis.scale.getExtent()[1];
      const yMin = yAxis.axis.scale.getExtent()[0];
      const yMax = yAxis.axis.scale.getExtent()[1];

      const area = evt.areas[0];

      const [x0, x1] = area.coordRange[0];
      const [y0, y1] = area.coordRange[1];

      const clampedCoordRange: [[number, number], [number, number]] = [
        [Math.max(xMin, x0), Math.min(xMax, x1)],
        [Math.max(yMin, y0), Math.min(yMax, y1)],
      ];

      const newBrushArea: EchartBrushAreas = [
        {
          ...area,
          coordRange: clampedCoordRange,
        },
      ];

      setBrushArea(newBrushArea);

      // Get the bottom right coordinates of the box
      const [clamped_x1, clamped_y0] = [clampedCoordRange[0][1], clampedCoordRange[1][0]];

      // Convert the bottom right coordinates to pixel coordinates, so that we can use them to
      // absolutely position the floating CTAs.
      const [clamped_x1_pixels, clamped_y0_pixels] = chart.convertToPixel(
        {xAxisIndex: 0, yAxisIndex: 0},
        [clamped_x1, clamped_y0]
      );

      const chartRect = chart.getDom().getBoundingClientRect();

      if (chartRect) {
        setFloatingTriggerPosition({
          left: chartRect.left + clamped_x1_pixels,
          top: chartRect.top + clamped_y0_pixels + window.scrollY,
        });
      }
    },
    [chartRef]
  );

  const clearSelection = useCallback(() => {
    const chartInstance = chartRef.current?.getEchartsInstance();
    chartInstance?.dispatchAction({type: 'brush', areas: []});
    setBrushArea(null);
    setFloatingTriggerPosition(null);
  }, [chartRef]);

  const handleOutsideClick = useCallback(
    (event: MouseEvent) => {
      if (
        chartWrapperRef.current &&
        !chartWrapperRef.current.contains(event.target as Node) &&
        triggerWrapperRef.current &&
        !triggerWrapperRef.current.contains(event.target as Node)
      ) {
        clearSelection();
      }
    },
    [chartWrapperRef, triggerWrapperRef, clearSelection]
  );

  const enableBrushMode = useCallback(() => {
    const chartInstance = chartRef.current?.getEchartsInstance();
    chartInstance?.dispatchAction({
      type: 'takeGlobalCursor',
      key: 'brush',
      brushOption: EXPLORE_CHART_BRUSH_OPTION,
    });
  }, [chartRef]);

  useEffect(() => {
    if (!enabledBoxSelect) {
      return;
    }

    const chartInstance = chartRef.current?.getEchartsInstance();

    // Re-draw the box in the chart when a new brush area is set
    if (brushArea) {
      chartInstance?.dispatchAction({
        type: 'brush',
        areas: brushArea,
      });

      // We re-connect the group after drawing the box, so that the cursor is synced across all charts again.
      // Check the onBrushStart handler for more details.
      echarts?.connect(groupName);
    }

    // Activate brush mode on load and when we re-draw the box/clear the selection
    const frame = requestAnimationFrame(() => {
      enableBrushMode();
    });

    window.addEventListener('click', handleOutsideClick, {capture: true});

    // eslint-disable-next-line consistent-return
    return () => {
      window.removeEventListener('click', handleOutsideClick, {capture: true});
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    brushArea,
    chartRef.current,
    enableBrushMode,
    handleOutsideClick,
    floatingTriggerPosition,
    forceReActivateSelection,
  ]);

  const brush: BrushComponentOption | undefined = useMemo(() => {
    return enabledBoxSelect ? EXPLORE_CHART_BRUSH_OPTION : undefined;
  }, [enabledBoxSelect]);

  const toolBox = useMemo<ToolboxComponentOption | undefined>(() => {
    if (!brush) {
      return undefined;
    }

    return ToolBox(
      {
        show: false, // Prevent the toolbox from being shown, we enable selection on load
      },
      {
        brush: {
          type: ['rect'],
        },
      }
    );
  }, [brush]);

  const config: BoxSelectOptions = useMemo(() => {
    const coordRange = brushArea?.[0]?.coordRange ?? null;
    return {
      brush,
      boxCoordRange: coordRange
        ? {
            x: coordRange[0] as [number, number],
            y: coordRange[1] as [number, number],
          }
        : null,
      onBrushEnd,
      onBrushStart,
      toolBox,
      floatingTriggerPosition,
      reActivateSelection,
      clearSelection,
    };
  }, [
    brushArea,
    onBrushEnd,
    brush,
    toolBox,
    onBrushStart,
    floatingTriggerPosition,
    reActivateSelection,
    clearSelection,
  ]);

  return config;
}
