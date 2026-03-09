import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import type {ChartType} from 'sentry/chartcuterie/types';
import {LineChart as EChartsLineChart} from 'sentry/components/charts/lineChart';
import getBreakpointChartOptionsFromData, {
  type BreakpointEvidenceData,
  type EventBreakpointChartData,
} from 'sentry/components/events/eventStatisticalDetector/breakpointChartOptions';
import type {PageFilters} from 'sentry/types/core';
import {getUtcToLocalDateObject} from 'sentry/utils/dates';

interface ChartProps {
  chartType: ChartType;
  datetime: PageFilters['datetime'];
  evidenceData: BreakpointEvidenceData;
  percentileData: EventBreakpointChartData['percentileData'];
}

function LineChart({datetime, percentileData, evidenceData, chartType}: ChartProps) {
  const theme = useTheme();
  const normalizedDateTime = {
    period: datetime.period,
    start: datetime.start ? getUtcToLocalDateObject(datetime.start) : undefined,
    end: datetime.end ? getUtcToLocalDateObject(datetime.end) : undefined,
    utc: datetime.utc ?? undefined,
  };

  const {series, chartOptions} = useMemo(() => {
    return getBreakpointChartOptionsFromData(
      {percentileData, evidenceData},
      chartType,
      theme
    );
  }, [percentileData, evidenceData, chartType, theme]);

  return (
    <EChartsLineChart
      {...normalizedDateTime}
      {...chartOptions}
      isGroupedByDate
      showTimeInTooltip
      series={series}
    />
  );
}

export default LineChart;
