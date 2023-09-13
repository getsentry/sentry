import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import MarkLine from 'sentry/components/charts/components/markLine';
import ProgressRing from 'sentry/components/progressRing';
import {IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ProjectScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {getScoreColor} from 'sentry/views/performance/browser/webVitals/utils/getScoreColor';
import {useProjectWebVitalsTimeseriesQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsTimeseriesQuery';
import Chart from 'sentry/views/starfish/components/chart';

type Props = {
  projectScore: ProjectScore;
};

export function PerformanceScoreChart({projectScore}: Props) {
  const theme = useTheme();
  const {data, isLoading} = useProjectWebVitalsTimeseriesQuery();
  return (
    <Flex>
      <PerformanceScoreLabelContainer>
        <PerformanceScoreLabel>
          {t('Performance Score')} <StyledIconQuestion size="xs" />
        </PerformanceScoreLabel>
        <ProgressRingContainer>
          <ProgressRing
            value={projectScore.totalScore}
            text={projectScore.totalScore}
            size={120}
            barWidth={12}
            progressEndcaps="round"
            textCss={() => css`
              font-size: ${theme.fontSizeExtraLarge};
              font-weight: bold;
            `}
            progressColor={getScoreColor(projectScore.totalScore, theme)}
          />
        </ProgressRingContainer>
      </PerformanceScoreLabelContainer>
      <ChartContainer>
        <Chart
          height={200}
          data={[
            {
              data,
              seriesName: 'Performance Score',
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
          chartColors={[getScoreColor(projectScore.totalScore, theme)]}
          isLineChart
          grid={{
            left: 20,
            right: 50,
            top: 30,
            bottom: 10,
          }}
          visualMap={{
            pieces: [
              {
                gte: 0,
                lt: 50,
                color: '#93CE07',
              },
              {
                gte: 50,
                lt: 90,
                color: '#FBDB0F',
              },
              {
                gte: 90,
                lte: 100,
                color: '#FC7D02',
              },
            ],
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

const StyledIconQuestion = styled(IconQuestion)`
  position: relative;
  top: 1px;
`;

const ChartContainer = styled('div')`
  flex: 1;
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius};
`;

const PerformanceScoreLabelContainer = styled('div')`
  padding: ${space(2)};
  min-width: 200px;
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius};
  display: flex;
  align-items: center;
  flex-direction: column;
`;

const PerformanceScoreLabel = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray300};
  margin-bottom: ${space(1)};
`;

const ProgressRingContainer = styled('div')``;
