import LazyLoad from 'react-lazyload';

import MarkLine from 'sentry/components/charts/components/markLine';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import {t} from 'sentry/locale';
import {Group, TimeseriesValue} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import theme from 'sentry/utils/theme';

type Props = {
  data: Group;
  statsPeriod: string;
  height?: number;
  showMarkLine?: boolean;
  showSecondaryPoints?: boolean;
};

const GroupChart = ({
  data,
  statsPeriod,
  showSecondaryPoints = false,
  height = 24,
  showMarkLine = false,
}: Props) => {
  const stats: TimeseriesValue[] = statsPeriod
    ? data.filtered
      ? data.filtered.stats[statsPeriod]
      : data.stats[statsPeriod]
    : [];

  const secondaryStats: TimeseriesValue[] | null =
    statsPeriod && data.filtered ? data.stats[statsPeriod] : null;

  if (!stats || !stats.length) {
    return null;
  }

  const markLinePoint = stats.map(point => point[1]);
  const formattedMarkLine = formatAbbreviatedNumber(Math.max(...markLinePoint));

  let colors: string[] | undefined = undefined;
  let emphasisColors: string[] | undefined = undefined;

  const series: Series[] = [];
  if (showSecondaryPoints && secondaryStats && secondaryStats.length) {
    series.push({
      seriesName: t('Total Events'),
      data: secondaryStats.map(point => ({name: point[0] * 1000, value: point[1]})),
    });
    series.push({
      seriesName: t('Matching Events'),
      data: stats.map(point => ({name: point[0] * 1000, value: point[1]})),
    });
  } else {
    // Colors are custom to preserve historical appearance where the single series is
    // considerably darker than the two series results.
    colors = [theme.gray300];
    emphasisColors = [theme.purple300];
    series.push({
      seriesName: t('Events'),
      data: stats.map(point => ({name: point[0] * 1000, value: point[1]})),
      markLine:
        showMarkLine && Math.max(...markLinePoint) > 0
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

  return (
    <LazyLoad debounce={50} height={showMarkLine ? 30 : height}>
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
    </LazyLoad>
  );
};

export default GroupChart;
