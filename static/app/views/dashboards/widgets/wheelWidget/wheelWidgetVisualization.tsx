import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {PerformanceScoreSubtext} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreChart';
import PerformanceScoreRingWithTooltips from 'sentry/views/insights/browser/webVitals/components/performanceScoreRingWithTooltips';
import {
  getWebVitalScoresFromTableDataRow,
  type WebVitalScores,
} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/getWebVitalScoresFromTableDataRow';

interface WheelWidgetVisualizationProps {
  loading: boolean;
  selection: PageFilters;
  tableResults?: TableDataWithTitle[];
}

export function WheelWidgetVisualization({
  tableResults,
  loading,
  selection,
}: WheelWidgetVisualizationProps) {
  const theme = useTheme();
  const ringSegmentColors = theme.chart.getColorPalette(4).slice() as unknown as string[];
  const ringBackgroundColors = ringSegmentColors.map(color => `${color}50`);

  const row = tableResults?.[0]?.data?.[0];
  const projectScore = row
    ? getWebVitalScoresFromTableDataRow(row as unknown as WebVitalScores)
    : undefined;
  const score = projectScore?.totalScore;
  const period = loading ? null : selection.datetime.period;
  const performanceScoreSubtext =
    (period &&
      DEFAULT_RELATIVE_PERIODS[period as keyof typeof DEFAULT_RELATIVE_PERIODS]) ??
    '';

  if (!defined(projectScore)) {
    return null;
  }

  return (
    <Container>
      <PerformanceScoreSubtext>{performanceScoreSubtext}</PerformanceScoreSubtext>
      <Flex justify="center" align="center">
        <PerformanceScoreRingWithTooltips
          projectScore={projectScore}
          text={score}
          width={220}
          height={200}
          ringBackgroundColors={ringBackgroundColors}
          ringSegmentColors={ringSegmentColors}
        />
      </Flex>
    </Container>
  );
}

const Container = styled('div')`
  padding: 0 ${space(2)};
`;
