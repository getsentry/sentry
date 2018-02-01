import LazyLoad from 'react-lazy-load';
import React from 'react';

import createReactClass from 'create-react-class';

import BarChart from '../../../../components/barChart';
import SentryTypes from '../../../../proptypes';

const ProjectStatsGraph = createReactClass({
  displayName: 'ProjectListItem',

  propTypes: {
    project: SentryTypes.Project,
  },

  render() {
    let {project} = this.props;
    let chartData =
      project.stats &&
      project.stats.map(point => {
        return {x: point[0], y: point[1]};
      });

    return (
      <div>
        {chartData && (
          <LazyLoad>
            <BarChart height={30} points={chartData} label="events" />
          </LazyLoad>
        )}
      </div>
    );
  },
});

export default ProjectStatsGraph;
