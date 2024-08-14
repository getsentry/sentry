import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import type {FunctionRegressionPercentileData} from 'sentry/chartcuterie/performance';
import type {ChartType} from 'sentry/chartcuterie/types';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart as EChartsLineChart} from 'sentry/components/charts/lineChart';
import getBreakpointChartOptionsFromData from 'sentry/components/events/eventStatisticalDetector/breakpointChartOptions';
import type {PageFilters} from 'sentry/types/core';
import type {EventsStatsData} from 'sentry/types/organization';
import useRouter from 'sentry/utils/useRouter';
import type {NormalizedTrendsTransaction} from 'sentry/views/performance/trends/types';

interface ChartProps {
  chartType: ChartType;
  datetime: PageFilters['datetime'];
  evidenceData: NormalizedTrendsTransaction;
  percentileData: EventsStatsData | FunctionRegressionPercentileData;
  trendFunctionName?: string;
}

function LineChart({datetime, percentileData, evidenceData, chartType}: ChartProps) {
  const theme = useTheme();
  const router = useRouter();

  const {series, chartOptions} = useMemo(() => {
    return getBreakpointChartOptionsFromData(
      {percentileData, evidenceData},
      chartType,
      theme
    );
  }, [percentileData, evidenceData, chartType, theme]);

  return (
    <ChartZoom router={router} {...datetime}>
      {zoomRenderProps => (
        <EChartsLineChart {...zoomRenderProps} {...chartOptions} series={series} />
      )}
    </ChartZoom>
  );
}

export default LineChart;
