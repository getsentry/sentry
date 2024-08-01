import {useTheme} from '@emotion/react';

import ScoreRing from 'sentry/components/devtoolbar/components/performance/scoreRing';
import {useScoreRing} from 'sentry/components/devtoolbar/components/performance/useScoreRing';
import Placeholder from 'sentry/components/placeholder';
import {calculatePerformanceScoreFromStoredTableDataRow} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/calculatePerformanceScoreFromStored';

import useCurrentTransactionName from '../../hooks/useCurrentTransactionName';
import {panelInsetContentCss, panelSectionCss} from '../../styles/panel';
import {smallCss} from '../../styles/typography';
import PanelLayout from '../panelLayout';

export default function PerformancePanel() {
  const transaction = useCurrentTransactionName();
  const theme = useTheme();

  // copied from pageOverviewSidebar.tsx
  const ringSegmentColors = theme.charts.getColorPalette(3);
  const ringBackgroundColors = ringSegmentColors.map(color => `${color}50`);

  const {data: projectScores, isLoading: isProjectScoresLoading} = useScoreRing({
    transaction,
  });

  const projectScore = isProjectScoresLoading
    ? undefined
    : calculatePerformanceScoreFromStoredTableDataRow(projectScores?.data?.[0]);

  return (
    <PanelLayout title="Performance">
      <div css={[smallCss, panelSectionCss, panelInsetContentCss]}>
        <span>
          Performance scores for <code>{transaction}</code>
        </span>
        <div
          css={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: `var(--space100)`,
            marginTop: `var(--space100)`,
          }}
        >
          {isProjectScoresLoading && <Placeholder width="300px" height="160px" />}
          {!isProjectScoresLoading && projectScore && (
            <ScoreRing
              projectScore={projectScore}
              text={projectScore.totalScore}
              width={220}
              height={200}
              ringBackgroundColors={ringBackgroundColors}
              ringSegmentColors={ringSegmentColors}
            />
          )}
        </div>
      </div>
    </PanelLayout>
  );
}
