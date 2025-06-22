import {useEffect, useMemo, useState} from 'react';
import type {BrushComponentOption, EChartsOption, ToolboxComponentOption} from 'echarts';
import type EChartsReact from 'echarts-for-react';

import type {
  EchartBrushAreas,
  EChartBrushEndHandler,
  EChartBrushStartHandler,
} from 'sentry/types/echarts';
import type {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';

type Props = {
  chartRef: React.RefObject<EChartsReact | null>;
  chartWrapperRef: React.RefObject<HTMLDivElement | null>;
  visualizes: Visualize[];
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
  toolbox: ['rect'],
  brushMode: 'single',
  throttleType: 'debounce',
  throttleDelay: 100,
  xAxisIndex: 0,
  yAxisIndex: 0,
  brushStyle: {},
  removeOnClick: false,
  transformable: true,
};

export function useChartBoxSelect(props: Props): BoxSelectOptions {
  const {chartRef, chartWrapperRef} = props;
  const [brushArea, setBrushArea] = useState<EchartBrushAreas | null>(null);
  // Redraw the chart when the brush area changes
  useEffect(() => {
    const chartInstance = chartRef.current?.getEchartsInstance();
    if (brushArea) {
      chartInstance?.dispatchAction({
        type: 'brush',
        areas: brushArea,
      });
    }

    chartInstance?.dispatchAction({
      type: 'takeGlobalCursor',
      key: 'brush',
      brushOption: {
        brushType: 'rect',
        brushMode: 'single',
        throttleType: 'debounce',
        throttleDelay: 100,
        xAxisIndex: 0,
        yAxisIndex: 0,
        brushStyle: {},
        removeOnClick: false,
        transformable: true,
      },
    });
  }, [brushArea, chartRef]);

  useEffect(() => {
    const chart = chartRef.current?.getEchartsInstance?.();

    // Brush end event listener
    const onBrushEnd = params => {
      setBrushArea(params.areas);
    };

    chart?.on('brushEnd', onBrushEnd);

    const enableBrushMode = () => {
      chart?.dispatchAction({
        type: 'takeGlobalCursor',
        key: 'brush',
        brushOption: {
          brushType: 'rect',
          brushMode: 'single',
          throttleType: 'debounce',
          throttleDelay: 100,
          xAxisIndex: 0,
          yAxisIndex: 0,
          brushStyle: {},
          removeOnClick: false,
          transformable: true,
        },
      });
    };

    const timer = setTimeout(enableBrushMode, 100); // Defer to ensure ECharts is ready

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        chartWrapperRef.current &&
        !chartWrapperRef.current.contains(event.target as Node)
      ) {
        chart?.dispatchAction({type: 'brush', areas: []});
        setBrushArea(null);

        // Re-enable brush mode immediately so user can draw agai
      }
    };

    window.addEventListener('click', handleOutsideClick);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleOutsideClick);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartRef.current, chartWrapperRef]);

  const config: BoxSelectOptions = useMemo(() => {
    return {brushArea};
  }, [brushArea]);

  return config;
}
