import {useTheme} from '@emotion/react';

import {Stack} from '@sentry/scraps/layout';

import {defined} from 'sentry/utils/defined';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {WidgetType, type Widget} from 'sentry/views/dashboards/types';
import {getWebVitalScoresFromTraceMetricsRow} from 'sentry/views/dashboards/utils/webVitalTraceMetricFields';
import {PerformanceScoreRingWithTooltips} from 'sentry/views/insights/browser/webVitals/components/performanceScoreRingWithTooltips';
import {
  getWebVitalScoresFromTableDataRow,
  type WebVitalScores,
} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/getWebVitalScoresFromTableDataRow';

interface WheelWidgetVisualizationProps {
  tableResults?: TableDataWithTitle[];
  widget?: Widget;
}

export function WheelWidgetVisualization({
  tableResults,
  widget,
}: WheelWidgetVisualizationProps) {
  const theme = useTheme();
  const ringSegmentColors = theme.chart.getColorPalette(4).slice() as unknown as string[];
  const ringBackgroundColors = ringSegmentColors.map(color => `${color}50`);

  const row = tableResults?.[0]?.data?.[0];
  const projectScore = row
    ? widget?.widgetType === WidgetType.TRACEMETRICS
      ? getWebVitalScoresFromTraceMetricsRow(row)
      : getWebVitalScoresFromTableDataRow(row as unknown as WebVitalScores)
    : undefined;
  const score = projectScore?.totalScore;

  if (!defined(projectScore)) {
    return null;
  }

  return (
    <Stack justify="center" align="center" height="100%">
      <PerformanceScoreRingWithTooltips
        autoSize
        projectScore={projectScore}
        text={score}
        ringBackgroundColors={ringBackgroundColors}
        ringSegmentColors={ringSegmentColors}
      />
    </Stack>
  );
}
