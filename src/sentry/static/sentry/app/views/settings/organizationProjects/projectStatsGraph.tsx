import React from 'react';
import LazyLoad from 'react-lazyload';

import {Project} from 'app/types';
import BarChart from 'app/components/barChart';

type Props = {
  project: Project;
  stats?: Project['stats'];
};

const ProjectStatsGraph = ({project, stats}: Props) => {
  stats = stats || project.stats;
  const chartData = stats && stats.map(point => ({x: point[0], y: point[1]}));

  return (
    <div>
      {chartData && (
        <LazyLoad height={25} debounce={50}>
          <BarChart
            height={25}
            minHeights={[3]}
            gap={1}
            points={chartData}
            label="events"
          />
        </LazyLoad>
      )}
    </div>
  );
};

export default ProjectStatsGraph;
