import {useCallback, useEffect, useMemo, useReducer, useState} from 'react';
import type {BrushComponentOption, EChartsOption, ToolboxComponentOption} from 'echarts';
import type EChartsReact from 'echarts-for-react';

import ToolBox from 'sentry/components/charts/components/toolBox';
import type {EchartBrushAreas, EChartBrushEndHandler} from 'sentry/types/echarts';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  chartRef: React.RefObject<EChartsReact | null>;
  chartWrapperRef: React.RefObject<HTMLDivElement | null>;
  triggerWrapperRef: React.RefObject<HTMLDivElement | null>;
};

export type BoxSelectOptions = {
  brush: EChartsOption['brush'];
  brushArea: EchartBrushAreas | null;
  onBrushEnd: EChartBrushEndHandler;
  pageCoords: {x: number; y: number} | null;
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
  const enabledBoxSelect = organization.features.includes(
    'performance-spans-suspect-attributes'
  );
  const [brushArea, setBrushArea] = useState<EchartBrushAreas | null>(null);
  const [pageCoords, setPageCoords] = useState<{x: number; y: number} | null>(null);

  const [forceReActivateSelection, reActivateSelection] = useReducer(
    x => (x + 1) % Number.MAX_SAFE_INTEGER,
    0
  );

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

      const newBrushArea: EchartBrushAreas = [
        {
          ...area,
          coordRange: [
            [
              Math.max(xMin, area.coordRange[0][0]),
              Math.min(xMax, area.coordRange[0][1]),
            ],
            [
              Math.max(yMin, area.coordRange[1][0]),
              Math.min(yMax, area.coordRange[1][1]),
            ],
          ],
        },
      ];

      setBrushArea(newBrushArea);
    },
    [chartRef]
  );

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      if (brushArea) {
        setPageCoords({x: e.clientX, y: e.clientY});
      } else {
        setPageCoords(null);
      }
    };

    const wrapper = chartWrapperRef.current;
    if (!wrapper) return;

    wrapper.addEventListener('mouseup', handleMouseUp);
  }, [brushArea, chartWrapperRef]);

  const handleOutsideClick = useCallback(
    (event: MouseEvent) => {
      const chartInstance = chartRef.current?.getEchartsInstance();
      if (
        chartWrapperRef.current &&
        !chartWrapperRef.current.contains(event.target as Node) &&
        triggerWrapperRef.current &&
        !triggerWrapperRef.current.contains(event.target as Node)
      ) {
        chartInstance?.dispatchAction({type: 'brush', areas: []});
        setBrushArea(null);
        setPageCoords(null);
      }
    },
    [chartWrapperRef, triggerWrapperRef, chartRef]
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
    }

    // Activate brush mode on load and when we re-draw the box/clear the selection
    const frame = requestAnimationFrame(() => {
      enableBrushMode();
    });

    window.addEventListener('click', handleOutsideClick);

    // eslint-disable-next-line consistent-return
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    brushArea,
    chartRef.current,
    enableBrushMode,
    handleOutsideClick,
    pageCoords,
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
    return {
      brush,
      brushArea,
      onBrushEnd,
      toolBox,
      pageCoords,
      reActivateSelection,
    };
  }, [brushArea, onBrushEnd, brush, toolBox, pageCoords, reActivateSelection]);

  return config;
}
