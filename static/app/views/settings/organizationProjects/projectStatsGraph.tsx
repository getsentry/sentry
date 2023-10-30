import {Fragment} from 'react';
import LazyLoad from 'react-lazyload';

import MiniBarChart from 'sentry/components/charts/miniBarChart';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';
import {Series} from 'sentry/types/echarts';

type Props = {
  project: Project;
  stats?: Project['stats'];
};

function ProjectStatsGraph({project, stats}: Props) {
  stats = stats || project.stats || [];
  const series: Series[] = [
    {
      seriesName: t('Events'),
      data: stats.map(point => ({name: point[0] * 1000, value: point[1]})),
    },
  ];

  return (
    <Fragment>
      {series && (
        <LazyLoad height={25} debounce={50}>
          <MiniBarChart isGroupedByDate showTimeInTooltip series={series} height={25} />
        </LazyLoad>
      )}
    </Fragment>
  );
}

export default ProjectStatsGraph;
