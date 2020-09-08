import LazyLoad from 'react-lazyload';
import React from 'react';

import {Group, GroupStats} from 'app/types';
import BarChart from 'app/components/barChart';

type Props = {
  statsPeriod: string;
  data: Group;
  hasDynamicIssueCounts?: boolean;
  height: number;
};

function GroupChart({data, hasDynamicIssueCounts, statsPeriod, height = 24}: Props) {
  // TODO: @taylangocmen pass filtered and unfiltered stats separately to chart and render both

  const stats: GroupStats[] = statsPeriod
    ? hasDynamicIssueCounts && data.filtered
      ? data.filtered.stats[statsPeriod]
      : data.stats[statsPeriod]
    : null;

  if (!stats || !stats.length) {
    return null;
  }
  const chartData = stats.map(point => ({x: point[0], y: point[1]}));

  return (
    <LazyLoad debounce={50} height={height}>
      <BarChart
        points={chartData}
        height={height}
        label="events"
        minHeights={[3]}
        gap={1}
      />
    </LazyLoad>
  );
}

export default GroupChart;
