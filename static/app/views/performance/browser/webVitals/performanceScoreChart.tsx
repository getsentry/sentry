import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import toUpper from 'lodash/toUpper';

import MarkLine from 'sentry/components/charts/components/markLine';
import ProgressRing from 'sentry/components/progressRing';
import {IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ProjectScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {getScoreColor} from 'sentry/views/performance/browser/webVitals/utils/getScoreColor';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useProjectWebVitalsTimeseriesQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsTimeseriesQuery';
import Chart from 'sentry/views/starfish/components/chart';

type Props = {
  projectScore: ProjectScore;
  webVital?: WebVitals | null;
};

export function PerformanceScoreChart({projectScore, webVital}: Props) {
  const theme = useTheme();
  const {data, isLoading} = useProjectWebVitalsTimeseriesQuery({webVital});
  const score = webVital ? projectScore[`${webVital}Score`] : projectScore.totalScore;
  return (
    <Flex>
      <PerformanceScoreLabelContainer>
        <PerformanceScoreLabel>
          {`${webVital ? `${toUpper(webVital)} Score` : t('Performance Score')}`}{' '}
          {!webVital && <StyledIconQuestion size="xs" />}
        </PerformanceScoreLabel>
        <ProgressRingContainer>
          <ProgressRing
            value={score}
            text={score}
            size={120}
            barWidth={12}
            progressEndcaps="round"
            textCss={() => css`
              font-size: ${theme.fontSizeExtraLarge};
              font-weight: bold;
            `}
            progressColor={getScoreColor(score, theme)}
          />
        </ProgressRingContainer>
      </PerformanceScoreLabelContainer>
      <ChartContainer>
        <Chart
          height={200}
          data={[
            {
              data,
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
          chartColors={[getScoreColor(score, theme)]}
          isLineChart
          grid={{
            left: 20,
            right: 50,
            top: 30,
            bottom: 10,
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
