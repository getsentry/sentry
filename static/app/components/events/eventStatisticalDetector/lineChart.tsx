import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart as EChartsLineChart} from 'sentry/components/charts/lineChart';
import getBreakpointChartOptionsFromData from 'sentry/components/events/eventStatisticalDetector/breakpointChartOptions';
import type {PageFilters} from 'sentry/types';
import type {Series} from 'sentry/types/echarts';
import useRouter from 'sentry/utils/useRouter';
import type {NormalizedTrendsTransaction} from 'sentry/views/performance/trends/types';

interface ChartProps {
  datetime: PageFilters['datetime'];
  evidenceData: NormalizedTrendsTransaction;
  percentileSeries: Series[];
}

function LineChart({datetime, percentileSeries, evidenceData}: ChartProps) {
  const theme = useTheme();
  const router = useRouter();

  const {series, chartOptions} = useMemo(() => {
    return getBreakpointChartOptionsFromData({percentileSeries, evidenceData}, theme);
  }, [percentileSeries, evidenceData, theme]);

  return (
    <ChartZoom router={router} {...datetime}>
      {zoomRenderProps => (
        <EChartsLineChart {...zoomRenderProps} {...chartOptions} series={series} />
      )}
    </ChartZoom>
  );
}

export default LineChart;
