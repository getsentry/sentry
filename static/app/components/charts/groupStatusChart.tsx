import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import MarkLine from 'sentry/components/charts/components/markLine';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import {LazyRender} from 'sentry/components/lazyRender';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {TimeseriesValue} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {isChonkTheme} from 'sentry/utils/theme/withChonk';

function asChartPoint(point: [number, number]): {name: number | string; value: number} {
  return {
    name: point[0] * 1000,
    value: point[1],
  };
}

const EMPTY_STATS: readonly TimeseriesValue[] = [];

type Props = {
  stats: readonly TimeseriesValue[];
  groupStatus?: string;
  height?: number;
  hideZeros?: boolean;
  loading?: boolean;
  secondaryStats?: readonly TimeseriesValue[];
  showMarkLine?: boolean;
  showSecondaryPoints?: boolean;
};

function GroupStatusChart({
  stats,
  groupStatus,
  height = 24,
  loading = false,
  hideZeros = false,
  secondaryStats = EMPTY_STATS,
  showMarkLine = false,
  showSecondaryPoints = false,
}: Props) {
  const theme = useTheme();
  const graphOptions = useMemo<{
    colors: [string] | undefined;
    emphasisColors: [string] | undefined;
    series: Series[];
  }>(() => {
    if (!stats || !stats.length) {
      return {colors: undefined, emphasisColors: undefined, series: []};
    }
    const max = Math.max(...stats.map(p => p[1]));

    const formattedMarkLine = formatAbbreviatedNumber(max);

    if (showSecondaryPoints && secondaryStats && secondaryStats.length) {
      const series: Series[] = [
        {
          seriesName: t('Total Events'),
          data: secondaryStats.map(asChartPoint),
        },
        {
          seriesName: t('Matching Events'),
          data: stats.map(asChartPoint),
        },
      ];

      return {colors: undefined, emphasisColors: undefined, series};
    }

    const marklineColor = isChonkTheme(theme)
      ? theme.colors.content.muted
      : theme.gray200;
    const marklineLabelColor = isChonkTheme(theme)
      ? theme.colors.content.primary
      : theme.gray300;
    const chartColor = isChonkTheme(theme) ? theme.colors.content.primary : theme.gray300;

    const series: Series[] = [
      {
        seriesName: t('Events'),
        data: stats.map(asChartPoint),
        markLine:
          showMarkLine && max > 0
            ? MarkLine({
                silent: true,
                lineStyle: {
                  color: marklineColor,
                  type: [4, 3], // Sets line type to "dashed" with 4 length and 3 gap
                  opacity: 0.6,
                  cap: 'round', // Rounded edges for the dashes
                },
                data: [
                  {
                    type: 'max',
                  },
                ],
                animation: false,
                label: {
                  show: true,
                  position: 'end',
                  opacity: 1,
                  color: marklineLabelColor,
                  fontFamily: 'Rubik',
                  fontSize: 10,
                  formatter: `${formattedMarkLine}`,
                },
              })
            : undefined,
      },
    ];

    return {colors: [chartColor], emphasisColors: [chartColor], series};
  }, [showSecondaryPoints, secondaryStats, showMarkLine, stats, theme]);

  return (
    <LazyRender containerHeight={showMarkLine ? 26 : height}>
      <ChartWrapper>
        {loading ? (
          <Placeholder height={'36px'} />
        ) : (
          <ChartAnimationWrapper>
            <MiniBarChart
              animateBars
              showXAxisLine
              hideZeros={hideZeros}
              markLineLabelSide="right"
              barOpacity={0.4}
              height={showMarkLine ? 36 : height}
              isGroupedByDate
              showTimeInTooltip
              series={graphOptions.series}
              colors={graphOptions.colors}
              emphasisColors={graphOptions.emphasisColors}
              hideDelay={50}
              showMarkLineLabel={showMarkLine}
            />
          </ChartAnimationWrapper>
        )}
        <GraphText>{groupStatus}</GraphText>
      </ChartWrapper>
    </LazyRender>
  );
}

export default GroupStatusChart;

const ChartAnimationWrapper = styled('div')`
  animation: fade-in 0.5s;

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 100;
    }
  }
`;

const ChartWrapper = styled('div')`
  display: flex;
  flex-direction: column;
`;

const GraphText = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;
