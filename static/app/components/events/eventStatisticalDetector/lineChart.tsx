import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart as EChartsLineChart} from 'sentry/components/charts/lineChart';
import getBreakpointChartOptionsFromData from 'sentry/components/events/eventStatisticalDetector/breakpointChartOptions';
import type {EventsStatsData, PageFilters} from 'sentry/types';
import type {Series} from 'sentry/types/echarts';
import useRouter from 'sentry/utils/useRouter';
import type {NormalizedTrendsTransaction} from 'sentry/views/performance/trends/types';

interface ChartProps {
  datetime: PageFilters['datetime'];
  evidenceData: NormalizedTrendsTransaction;
  // TODO @athena: Refactor functionBreakpointChart to use percentileData
  percentileData?: EventsStatsData;
  percentileSeries?: Series[];
}

function LineChart({
  datetime,
  percentileData,
  percentileSeries,
  evidenceData,
}: ChartProps) {
  const theme = useTheme();
  const router = useRouter();

  const {series, chartOptions} = useMemo(() => {
    return getBreakpointChartOptionsFromData(
      {percentileData, percentileSeries, evidenceData},
      theme
    );
  }, [percentileData, percentileSeries, evidenceData, theme]);

  return (
    <ChartZoom router={router} {...datetime}>
      {zoomRenderProps => (
        <EChartsLineChart {...zoomRenderProps} {...chartOptions} series={series} />
      )}
    </ChartZoom>
  );
}

export default LineChart;
