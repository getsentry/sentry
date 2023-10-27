import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import usePageFilters from 'sentry/utils/usePageFilters';
import {PerformanceScoreBreakdownChart} from 'sentry/views/performance/browser/webVitals/components/performanceScoreBreakdownChart';
import {ProjectScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

import PerformanceScoreRingWithTooltips from './components/performanceScoreRingWithTooltips';

type Props = {
  isProjectScoreLoading?: boolean;
  projectScore?: ProjectScore;
  transaction?: string;
  webVital?: WebVitals | null;
};

export const ORDER = ['lcp', 'fcp', 'fid', 'cls', 'ttfb'];

export function PerformanceScoreChart({
  projectScore,
  webVital,
  transaction,
  isProjectScoreLoading,
}: Props) {
  const theme = useTheme();
  const pageFilters = usePageFilters();

  const score = projectScore
    ? webVital
      ? projectScore[`${webVital}Score`]
      : projectScore.totalScore
    : undefined;

  let ringSegmentColors = theme.charts.getColorPalette(3);
  let ringBackgroundColors = ringSegmentColors.map(color => `${color}50`);

  if (webVital) {
    const index = ORDER.indexOf(webVital);
    ringSegmentColors = ringSegmentColors.map((color, i) => {
      return i === index ? color : theme.gray200;
    });
    ringBackgroundColors = ringBackgroundColors.map((color, i) => {
      return i === index ? color : `${theme.gray200}33`;
    });
  }

  const period = pageFilters.selection.datetime.period;
  const performanceScoreSubtext = (period && DEFAULT_RELATIVE_PERIODS[period]) ?? '';

  return (
    <Flex>
      <PerformanceScoreLabelContainer>
        <PerformanceScoreLabel>{t('Performance Score')}</PerformanceScoreLabel>
        <PerformanceScoreSubtext>{performanceScoreSubtext}</PerformanceScoreSubtext>
        {!isProjectScoreLoading && projectScore && (
          <PerformanceScoreRingWithTooltips
            projectScore={projectScore}
            text={score}
            width={220}
            height={180}
            ringBackgroundColors={ringBackgroundColors}
            ringSegmentColors={ringSegmentColors}
          />
        )}
        {!isProjectScoreLoading && !projectScore && (
          <EmptyStateWarning>
            <p>{t('No Web Vitals found')}</p>
          </EmptyStateWarning>
        )}
      </PerformanceScoreLabelContainer>
      <PerformanceScoreBreakdownChart transaction={transaction} />
    </Flex>
  );
}

const Flex = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  gap: ${space(1)};
  margin-top: ${space(1)};
`;

const PerformanceScoreLabelContainer = styled('div')`
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
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
`;

const PerformanceScoreSubtext = styled('div')`
  width: 100%;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  margin-bottom: ${space(1)};
`;
