import LazyLoad from 'react-lazyload';
import React from 'react';

import {Group, GroupStats} from 'app/types';
import BarChart from 'app/components/barChart';

type Props = {
  statsPeriod: string;
  data: Group;
  hasDynamicIssueCounts?: boolean;
  height: number;
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
  const chartData = stats.map(point => ({x: point[0], y: point[1]}));
  const secondaryChartData =
    secondaryStats && secondaryStats.length
      ? secondaryStats.map(point => ({x: point[0], y: point[1]}))
      : [];

  return (
    <LazyLoad debounce={50} height={height}>
      <BarChart
        points={chartData}
        secondaryPoints={secondaryChartData}
        showSecondaryPoints={showSecondaryPoints}
        height={height}
        label="events"
        minHeights={[3]}
        gap={1}
      />
    </LazyLoad>
  );
}

export default GroupChart;
