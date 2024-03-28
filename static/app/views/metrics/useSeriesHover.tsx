import {useCallback, useRef} from 'react';

import type {ReactEchartsRef} from 'sentry/types/echarts';

export function useSeriesHover() {
  const chartRef = useRef<ReactEchartsRef>(null);

  const setHoveredSeries = useCallback((seriesId: string | string[]) => {
    if (!chartRef.current) {
      return;
    }
    const echartsInstance = chartRef.current.getEchartsInstance();
    echartsInstance.dispatchAction({
      type: 'highlight',
      seriesId,
    });
  }, []);

  return {
    chartRef,
    setHoveredSeries,
  };
}
