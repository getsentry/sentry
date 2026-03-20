import {useTheme} from '@emotion/react';

import {Flex} from '@sentry/scraps/layout';

import {defined} from 'sentry/utils';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {PerformanceScoreRingWithTooltips} from 'sentry/views/insights/browser/webVitals/components/performanceScoreRingWithTooltips';
import {
  getWebVitalScoresFromTableDataRow,
  type WebVitalScores,
} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/getWebVitalScoresFromTableDataRow';

interface WheelWidgetVisualizationProps {
  tableResults?: TableDataWithTitle[];
}

export function WheelWidgetVisualization({tableResults}: WheelWidgetVisualizationProps) {
  const theme = useTheme();
  const ringSegmentColors = theme.chart.getColorPalette(4).slice() as unknown as string[];
  const ringBackgroundColors = ringSegmentColors.map(color => `${color}50`);

  const row = tableResults?.[0]?.data?.[0];
  const projectScore = row
    ? getWebVitalScoresFromTableDataRow(row as unknown as WebVitalScores)
    : undefined;
  const score = projectScore?.totalScore;

  if (!defined(projectScore)) {
    return null;
  }

  return (
    <Flex justify="center" align="center" direction="column" height="100%">
      <PerformanceScoreRingWithTooltips
        autoSize
        projectScore={projectScore}
        text={score}
        y={30}
        ringBackgroundColors={ringBackgroundColors}
        ringSegmentColors={ringSegmentColors}
      />
    </Flex>
  );
}
