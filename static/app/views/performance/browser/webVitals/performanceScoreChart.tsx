import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import toUpper from 'lodash/toUpper';

import MarkLine from 'sentry/components/charts/components/markLine';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import usePageFilters from 'sentry/utils/usePageFilters';
import PerformanceScoreRing from 'sentry/views/performance/browser/webVitals/components/performanceScoreRing';
import {
  PERFORMANCE_SCORE_WEIGHTS,
  ProjectScore,
} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useProjectWebVitalsTimeseriesQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsTimeseriesQuery';
import Chart from 'sentry/views/starfish/components/chart';

type Props = {
  projectScore: ProjectScore;
  webVital?: WebVitals | null;
};

const {
  lcp: LCP_WEIGHT,
  fcp: FCP_WEIGHT,
  fid: FID_WEIGHT,
  cls: CLS_WEIGHT,
  ttfb: TTFB_WEIGHT,
} = PERFORMANCE_SCORE_WEIGHTS;

export function PerformanceScoreChart({projectScore, webVital}: Props) {
  const theme = useTheme();
  const pageFilters = usePageFilters();

  const {data, isLoading} = useProjectWebVitalsTimeseriesQuery();
  const score = webVital ? projectScore[`${webVital}Score`] : projectScore.totalScore;
  const {lcpScore, fcpScore, fidScore, clsScore, ttfbScore} = projectScore;

  const segmentColors = theme.charts.getColorPalette(3);
  const backgroundColors = segmentColors.map(color => `${color}33`);

  const period = pageFilters.selection.datetime.period;
  const performanceScoreSubtext =
    period && Object.keys(DEFAULT_RELATIVE_PERIODS).includes(period)
      ? DEFAULT_RELATIVE_PERIODS[period]
      : '';
  return (
    <Flex>
      <PerformanceScoreLabelContainer>
        <PerformanceScoreLabel>
          {t('Performance Score')}
          <IconChevron size="xs" direction="down" style={{top: 1}} />
        </PerformanceScoreLabel>
        <PerformanceScoreSubtext>{performanceScoreSubtext}</PerformanceScoreSubtext>
        <ProgressRingContainer>
          <PerformanceScoreRing
            values={[
              lcpScore * LCP_WEIGHT * 0.01,
              fcpScore * FCP_WEIGHT * 0.01,
              fidScore * FID_WEIGHT * 0.01,
              clsScore * CLS_WEIGHT * 0.01,
              ttfbScore * TTFB_WEIGHT * 0.01,
            ]}
            maxValues={[LCP_WEIGHT, FCP_WEIGHT, FID_WEIGHT, CLS_WEIGHT, TTFB_WEIGHT]}
            text={score}
            size={140}
            barWidth={14}
            textCss={() => css`
              font-size: 32px;
              font-weight: bold;
              color: ${theme.textColor};
            `}
            segmentColors={segmentColors}
            backgroundColors={backgroundColors}
          />
        </ProgressRingContainer>
      </PerformanceScoreLabelContainer>
      <ChartContainer>
        <PerformanceScoreLabel>
          {t('Performance Score Breakdown')}
          <IconChevron size="xs" direction="down" style={{top: 1}} />
        </PerformanceScoreLabel>
        <PerformanceScoreSubtext>{performanceScoreSubtext}</PerformanceScoreSubtext>
        <Chart
          stacked
          height={160}
          data={[
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
            {
              data: [],
              seriesName: `${webVital ? toUpper(webVital) : 'Performance'} Score`,
              markLine: MarkLine({
                data: [
                  {
                    yAxis: 90,
                    lineStyle: {
                      color: theme.green200,
                      type: 'dashed',
                      width: 1,
                    },
                    label: {
                      position: 'end',
                      color: theme.green300,
                    },
                    emphasis: {
                      lineStyle: {
                        color: theme.green300,
                        type: 'dashed',
                        width: 1,
                      },
                    },
                  },
                  {
                    yAxis: 50,
                    lineStyle: {
                      color: theme.yellow200,
                      type: 'dashed',
                      width: 1,
                    },
                    label: {
                      position: 'end',
                      color: theme.yellow300,
                    },
                    emphasis: {
                      lineStyle: {
                        color: theme.yellow300,
                        type: 'dashed',
                        width: 1,
                      },
                    },
                  },
                ],
                label: {},
                symbol: ['none', 'none'],
                tooltip: {
                  show: false,
                },
              }),
            },
          ]}
          loading={isLoading}
          utc={false}
          grid={{
            left: 5,
            right: 20,
            top: 5,
            bottom: 0,
          }}
        />
      </ChartContainer>
    </Flex>
  );
}

const Flex = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  gap: ${space(2)};
  margin-top: ${space(2)};
`;

const ChartContainer = styled('div')`
  padding: ${space(2)};
  flex: 1;
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius};
`;

const PerformanceScoreLabelContainer = styled('div')`
  padding: ${space(2)};
  min-width: 320px;
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  align-items: center;
  flex-direction: column;
`;

const PerformanceScoreLabel = styled('div')`
  width: 100%;
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.textColor};
  font-weight: bold;
  margin-right: ${space(1)};
`;

const PerformanceScoreSubtext = styled('div')`
  width: 100%;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  margin-bottom: ${space(1)};
`;

const ProgressRingContainer = styled('div')`
  padding-top: ${space(1)};
`;
