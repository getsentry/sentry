import {useCallback, useEffect, useMemo, useState} from 'react';
import type {BrushComponentOption, EChartsOption, ToolboxComponentOption} from 'echarts';
import type EChartsReact from 'echarts-for-react';

import ToolBox from 'sentry/components/charts/components/toolBox';
import type {
  EchartBrushAreas,
  EChartBrushEndHandler,
  EChartBrushStartHandler,
} from 'sentry/types/echarts';
import useOrganization from 'sentry/utils/useOrganization';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

type Props = {
  chartRef: React.RefObject<EChartsReact | null>;
  chartResults: ReturnType<typeof useSortedTimeSeries>;
  chartWrapperRef: React.RefObject<HTMLDivElement | null>;
};

type BoxSelectOptions = {
  brush: EChartsOption['brush'];
  brushArea: EchartBrushAreas | null;
  onBrushEnd: EChartBrushEndHandler;
  onBrushStart: EChartBrushStartHandler;
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
  chartResults,
}: Props): BoxSelectOptions {
  const organization = useOrganization();
  const enabledBoxSelect = organization.features.includes(
    'performance-spans-suspect-attributes'
  );
  const [brushArea, setBrushArea] = useState<EchartBrushAreas | null>(null);

  const onBrushEnd = useCallback<EChartBrushEndHandler>(
    (evt: any, chart: any) => {
      if (!chartRef.current) return;

      const xAxis = chart.getModel().getComponent('xAxis', 0);
      const yAxis = chart.getModel().getComponent('yAxis', 0);

      const xMin = xAxis.axis.scale.getExtent()[0];
      const xMax = xAxis.axis.scale.getExtent()[1];
      const yMin = yAxis.axis.scale.getExtent()[0];
      const yMax = yAxis.axis.scale.getExtent()[1];

      const newBrushArea: EchartBrushAreas = [
        {
          ...evt.areas[0],
          coordRange: [
            [
              Math.max(xMin, evt.areas[0].coordRange[0][0]),
              Math.min(xMax, evt.areas[0].coordRange[0][1]),
            ],
            [
              Math.max(yMin, evt.areas[0].coordRange[1][0]),
              Math.min(yMax, evt.areas[0].coordRange[1][1]),
            ],
          ],
        },
      ];

      setBrushArea(newBrushArea);
    },
    [chartRef]
  );

  const onBrushStart = useCallback<EChartBrushStartHandler>(_ => {
    // TODO Abdulah Khan: Will be used to listen to mouse up event in the future.
  }, []);

  const handleOutsideClick = useCallback(
    (event: MouseEvent) => {
      const chartInstance = chartRef.current?.getEchartsInstance();
      if (
        chartWrapperRef.current &&
        !chartWrapperRef.current.contains(event.target as Node)
      ) {
        chartInstance?.dispatchAction({type: 'brush', areas: []});
        setBrushArea(null);
      }
    },
    [chartWrapperRef, chartRef]
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
  }, [brushArea, chartRef.current, enableBrushMode, handleOutsideClick, chartResults]);

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
    return {brush, brushArea, onBrushEnd, onBrushStart, toolBox};
  }, [brushArea, onBrushEnd, onBrushStart, brush, toolBox]);

  return config;
}
