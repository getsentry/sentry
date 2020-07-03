import LazyLoad from 'react-lazyload';
import React from 'react';
import PropTypes from 'prop-types';

import BarChart from 'app/components/barChart';
import SentryTypes from 'app/sentryTypes';

const ProjectStatsGraph = ({project, stats}) => {
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

ProjectStatsGraph.propTypes = {
  project: SentryTypes.Project,
  stats: PropTypes.array,
};

export default ProjectStatsGraph;
