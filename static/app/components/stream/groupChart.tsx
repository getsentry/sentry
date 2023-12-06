import {useMemo} from 'react';

import MarkLine from 'sentry/components/charts/components/markLine';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import {LazyRender} from 'sentry/components/lazyRender';
import {t} from 'sentry/locale';
import {Group, TimeseriesValue} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import theme from 'sentry/utils/theme';

function asChartPoint(point: [number, number]): {name: number | string; value: number} {
  return {
    name: point[0] * 1000,
    value: point[1],
  };
}

const EMPTY_STATS: ReadonlyArray<TimeseriesValue> = [];

type Props = {
  data: Group;
  statsPeriod: string;
  height?: number;
  showMarkLine?: boolean;
  showSecondaryPoints?: boolean;
};

function GroupChart({
  data,
  statsPeriod,
  showSecondaryPoints = false,
  height = 24,
  showMarkLine = false,
}: Props) {
  const stats: ReadonlyArray<TimeseriesValue> = statsPeriod
    ? data.filtered
      ? data.filtered.stats?.[statsPeriod]
      : data.stats?.[statsPeriod]
    : EMPTY_STATS;

  const secondaryStats: TimeseriesValue[] | null =
    statsPeriod && data.filtered ? data.stats[statsPeriod] : null;

  const [series, colors, emphasisColors]: [
    Series[],
    [string] | undefined,
    [string] | undefined,
  ] = useMemo(() => {
    if (!stats || !stats.length) {
      return [[], undefined, undefined];
    }

    let max = 0;
    const marklinePoints: number[] = [];

    for (let i = 0; i < stats.length; i++) {
      const point = stats[i];
      if (point[1] > max) {
        max = point[1];
      }
      marklinePoints.push(point[1]);
    }

    const formattedMarkLine = formatAbbreviatedNumber(max);

    const chartSeries: Series[] = [];
    let chartColors: [string] | undefined = undefined;
    let chartEmphasisColors: [string] | undefined = undefined;

    if (showSecondaryPoints && secondaryStats && secondaryStats.length) {
      chartSeries.push({
        seriesName: t('Total Events'),
        data: secondaryStats.map(asChartPoint),
      });
      chartSeries.push({
        seriesName: t('Matching Events'),
        data: stats.map(asChartPoint),
      });
    } else {
      // Colors are custom to preserve historical appearance where the single series is
      // considerably darker than the two series results.
      chartColors = [theme.gray300];
      chartEmphasisColors = [theme.purple300];
      chartSeries.push({
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
      });
    }
    return [chartSeries, chartColors, chartEmphasisColors];
  }, [showSecondaryPoints, secondaryStats, showMarkLine, stats]);

  return (
    <LazyRender containerHeight={showMarkLine ? 30 : height}>
      <MiniBarChart
        height={showMarkLine ? 36 : height}
        isGroupedByDate
        showTimeInTooltip
        series={series}
        colors={colors}
        emphasisColors={emphasisColors}
        hideDelay={50}
        showMarkLineLabel={showMarkLine}
      />
    </LazyRender>
  );
}

export default GroupChart;
