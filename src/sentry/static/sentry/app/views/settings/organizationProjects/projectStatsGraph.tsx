import React from 'react';
import LazyLoad from 'react-lazyload';

import {t} from 'app/locale';
import {Project} from 'app/types';
import {Series} from 'app/types/echarts';
import MiniBarChart from 'app/components/charts/miniBarChart';

type Props = {
  project: Project;
  stats?: Project['stats'];
};

const ProjectStatsGraph = ({project, stats}: Props) => {
  stats = stats || project.stats || [];
  const series: Series[] = [
    {
      seriesName: t('Events'),
      data: stats.map(point => ({name: point[0] * 1000, value: point[1]})),
    },
  ];

  return (
    <React.Fragment>
      {series && (
        <LazyLoad height={25} debounce={50}>
          <MiniBarChart isGroupedByDate showTimeInTooltip series={series} height={25} />
        </LazyLoad>
      )}
    </React.Fragment>
  );
};

export default ProjectStatsGraph;
