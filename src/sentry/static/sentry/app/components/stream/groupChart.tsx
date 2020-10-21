import LazyLoad from 'react-lazyload';

import {Series} from 'app/types/echarts';
import {Group, GroupStats} from 'app/types';
import {t} from 'app/locale';
import MiniBarChart from 'app/components/charts/miniBarChart';
import theme from 'app/utils/theme';

type Props = {
  statsPeriod: string;
  data: Group;
  hasDynamicIssueCounts?: boolean;
  height?: number;
  showSecondaryPoints?: boolean;
};

function GroupChart({
  data,
  hasDynamicIssueCounts,
  statsPeriod,
  showSecondaryPoints = false,
  height = 24,
}: Props) {
  const stats: GroupStats[] = statsPeriod
    ? hasDynamicIssueCounts && data.filtered
      ? data.filtered.stats[statsPeriod]
      : data.stats[statsPeriod]
    : null;

  const secondaryStats: GroupStats[] | null =
    statsPeriod && hasDynamicIssueCounts && data.filtered
      ? data.stats[statsPeriod]
      : null;

  if (!stats || !stats.length) {
    return null;
  }

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
    colors = [theme.gray500];
    emphasisColors = [theme.purple400];
    series.push({
      seriesName: t('Events'),
      data: stats.map(point => ({name: point[0] * 1000, value: point[1]})),
    });
  }

  return (
    <LazyLoad debounce={50} height={height}>
      <MiniBarChart
        height={height}
        isGroupedByDate
        showTimeInTooltip
        series={series}
        colors={colors}
        emphasisColors={emphasisColors}
      />
    </LazyLoad>
  );
}

export default GroupChart;
