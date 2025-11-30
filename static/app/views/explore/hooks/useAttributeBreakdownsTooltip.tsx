import {useEffect, useRef} from 'react';
import type {ECharts, TooltipComponentFormatterCallbackParams} from 'echarts';

import type {TooltipOption} from 'sentry/components/charts/baseChart';
import type {ReactEchartsRef} from 'sentry/types/echarts';

type Params = {
  chartRef: React.RefObject<ReactEchartsRef | null>;
  formatter: (params: TooltipComponentFormatterCallbackParams) => string;
};

export function useAttributeBreakdownsTooltip({
  chartRef,
  formatter,
}: Params): TooltipOption {
  const frozenPositionRef = useRef<[number, number] | null>(null);
  const tooltipParamsRef = useRef<TooltipComponentFormatterCallbackParams | null>(null);

  useEffect(() => {
    const chartInstance: ECharts | undefined = chartRef.current?.getEchartsInstance();
    if (!chartInstance) return;

    const dom = chartInstance.getDom();

    const handleClickAnywhere = (event: MouseEvent) => {
      event.preventDefault();

      const pixelPoint: [number, number] = [event.offsetX, event.offsetY];

      if (frozenPositionRef.current) {
        frozenPositionRef.current = null;
        tooltipParamsRef.current = null;
      } else {
        frozenPositionRef.current = pixelPoint;
      }
    };

    dom.addEventListener('click', handleClickAnywhere);

    // eslint-disable-next-line consistent-return
    return () => {
      dom.removeEventListener('click', handleClickAnywhere);
    };
  }, [chartRef, formatter, tooltipParamsRef, frozenPositionRef]);

  // Override tooltip behavior via formatter and position
  const tooltipConfig = {
    trigger: 'axis' as const,
    appendToBody: true as const,
    renderMode: 'html' as const,
    formatter: (params: TooltipComponentFormatterCallbackParams) => {
      if (!frozenPositionRef.current || !tooltipParamsRef.current) {
        tooltipParamsRef.current = params;
        return formatter(params);
      }
      return formatter(tooltipParamsRef.current);
    },
    position: (point: number[]) => {
      if (frozenPositionRef.current) {
        const [x, y] = frozenPositionRef.current;
        return [x + 20, y]; // frozen tooltip: move 20px right
      }

      const [x = 0, y = 0] = point;
      return [x + 20, y];
    },
  };

  return tooltipConfig;
}
