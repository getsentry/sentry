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
import type {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';

type Props = {
  chartRef: React.RefObject<EChartsReact | null>;
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

export function useChartBoxSelect(props: Props): BoxSelectOptions {
  const organization = useOrganization();
  const {chartRef} = props;
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

  // Disable box select if there are multiple y-axes or if there are multiple visualizations
  const enabledBoxSelect: boolean = useMemo(() => {
    if (!organization.features.includes('performance-spans-suspect-attributes')) {
      return false;
    }

    return !(
      props.visualizes.length > 1 ||
      props.visualizes.some(visualize => {
        return visualize.yAxes.length > 1;
      })
    );
  }, [props.visualizes, organization]);

  // Redraw the chart when the brush area changes
  useEffect(() => {
    if (brushArea) {
      const chartInstance = chartRef.current?.getEchartsInstance();
      chartInstance?.dispatchAction({
        type: 'brush',
        areas: brushArea,
      });
    }
  }, [brushArea, chartRef]);

  const brush: BrushComponentOption | undefined = useMemo(() => {
    return enabledBoxSelect ? EXPLORE_CHART_BRUSH_OPTION : undefined;
  }, [enabledBoxSelect]);

  const toolBox = useMemo<ToolboxComponentOption | undefined>(() => {
    if (!brush) {
      return undefined;
    }

    return ToolBox(
      {},
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
