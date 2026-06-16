import LazyLoad from 'react-lazyload';

import {MiniBarChart} from 'sentry/components/charts/miniBarChart';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import type {ProjectStats} from 'sentry/types/project';

type Props = {
  stats?: ProjectStats;
};

export function ProjectStatsGraph({stats}: Props) {
  const chartStats = stats ?? [];
  const series: Series[] = [
    {
      seriesName: t('Events'),
      data: chartStats.map(point => ({name: point[0] * 1000, value: point[1]})),
    },
  ];

  return (
    <LazyLoad height={25} debounce={50}>
      <MiniBarChart isGroupedByDate showTimeInTooltip series={series} height={25} />
    </LazyLoad>
  );
}
