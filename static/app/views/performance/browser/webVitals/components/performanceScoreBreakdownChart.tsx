import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import usePageFilters from 'sentry/utils/usePageFilters';
import {PERFORMANCE_SCORE_WEIGHTS} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {
  useProjectWebVitalsTimeseriesQuery,
  WebVitalsScoreBreakdown,
} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsTimeseriesQuery';
import Chart from 'sentry/views/starfish/components/chart';

const {
  lcp: LCP_WEIGHT,
  fcp: FCP_WEIGHT,
  fid: FID_WEIGHT,
  cls: CLS_WEIGHT,
  ttfb: TTFB_WEIGHT,
} = PERFORMANCE_SCORE_WEIGHTS;

type Props = {
  transaction?: string;
};

export const formatTimeSeriesResultsToChartData = (
  data: WebVitalsScoreBreakdown,
  segmentColors: string[]
): Series[] => {
  return [
    {
      data: data?.lcp.map(({name, value}) => ({
        name,
        value: value * LCP_WEIGHT * 0.01,
      })),
      seriesName: 'LCP',
      color: segmentColors[0],
    },
    {
      data: data?.fcp.map(
        ({name, value}) => ({
          name,
          value: value * FCP_WEIGHT * 0.01,
        }),
        []
      ),
      seriesName: 'FCP',
      color: segmentColors[1],
    },
    {
      data: data?.fid.map(
        ({name, value}) => ({
          name,
          value: value * FID_WEIGHT * 0.01,
        }),
        []
      ),
      seriesName: 'FID',
      color: segmentColors[2],
    },
    {
      data: data?.cls.map(
        ({name, value}) => ({
          name,
          value: value * CLS_WEIGHT * 0.01,
        }),
        []
      ),
      seriesName: 'CLS',
      color: segmentColors[3],
    },
    {
      data: data?.ttfb.map(
        ({name, value}) => ({
          name,
          value: value * TTFB_WEIGHT * 0.01,
        }),
        []
      ),
      seriesName: 'TTFB',
      color: segmentColors[4],
    },
  ];
};

export function PerformanceScoreBreakdownChart({transaction}: Props) {
  const theme = useTheme();
  const segmentColors = theme.charts.getColorPalette(3);

  const pageFilters = usePageFilters();

  const {data, isLoading} = useProjectWebVitalsTimeseriesQuery({transaction});

  const period = pageFilters.selection.datetime.period;
  const performanceScoreSubtext = (period && DEFAULT_RELATIVE_PERIODS[period]) ?? '';

  return (
    <ChartContainer>
      <PerformanceScoreLabel>{t('Score Breakdown')}</PerformanceScoreLabel>
      <PerformanceScoreSubtext>{performanceScoreSubtext}</PerformanceScoreSubtext>
      <Chart
        stacked
        height={180}
        data={formatTimeSeriesResultsToChartData(data, segmentColors)}
        disableXAxis
        loading={isLoading}
        utc={false}
        grid={{
          left: 5,
          right: 5,
          top: 5,
          bottom: 0,
        }}
        dataMax={100}
        chartColors={segmentColors}
      />
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  padding: ${space(2)} ${space(2)} ${space(1)} ${space(2)};
  flex: 1;
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius};
`;

const PerformanceScoreLabel = styled('div')`
  width: 100%;
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.textColor};
  font-weight: bold;
`;

const PerformanceScoreSubtext = styled('div')`
  width: 100%;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  margin-bottom: ${space(1)};
`;
