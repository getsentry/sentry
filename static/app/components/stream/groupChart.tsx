import {useMemo} from 'react';

import MarkLine from 'sentry/components/charts/components/markLine';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import {LazyRender} from 'sentry/components/lazyRender';
import {t} from 'sentry/locale';
import type {TimeseriesValue} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import theme from 'sentry/utils/theme';

function asChartPoint(point: [number, number]): {name: number | string; value: number} {
  return {
    name: point[0] * 1000,
    value: point[1],
  };
}

const EMPTY_STATS: readonly TimeseriesValue[] = [];

type Props = {
  stats: readonly TimeseriesValue[];
  height?: number;
  secondaryStats?: readonly TimeseriesValue[];
  showMarkLine?: boolean;
  showSecondaryPoints?: boolean;
};

function GroupChart({
  stats,
  height = 24,
  secondaryStats = EMPTY_STATS,
  showSecondaryPoints = false,
  showMarkLine = false,
}: Props) {
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
    const series: Series[] = [
      {
        seriesName: t('Events'),
        data: stats.map(asChartPoint),
        markLine:
          showMarkLine && max > 0
            ? MarkLine({
                silent: true,
                lineStyle: {color: theme.gray200, type: 'dotted', width: 1},
                data: [
                  {
                    type: 'max',
                  },
                ],
                label: {
                  show: true,
                  position: 'start',
                  color: `${theme.gray200}`,
                  fontFamily: 'Rubik',
                  fontSize: 10,
                  formatter: `${formattedMarkLine}`,
                },
              })
            : undefined,
      },
    ];
    return {colors: [theme.gray300], emphasisColors: [theme.purple300], series};
  }, [showSecondaryPoints, secondaryStats, showMarkLine, stats]);

  return (
    <LazyRender containerHeight={showMarkLine ? 30 : height}>
      <MiniBarChart
        height={showMarkLine ? 36 : height}
        isGroupedByDate
        showTimeInTooltip
        series={graphOptions.series}
        colors={graphOptions.colors}
        emphasisColors={graphOptions.emphasisColors}
        hideDelay={50}
        showMarkLineLabel={showMarkLine}
      />
    </LazyRender>
  );
}

export default GroupChart;
