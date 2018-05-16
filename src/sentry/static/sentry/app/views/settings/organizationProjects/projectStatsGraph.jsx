import LazyLoad from 'react-lazyload';
import React from 'react';
import PropTypes from 'prop-types';

import createReactClass from 'create-react-class';

import BarChart from 'app/components/barChart';
import SentryTypes from 'app/proptypes';

const ProjectStatsGraph = createReactClass({
  displayName: 'ProjectListItem',

  propTypes: {
    project: SentryTypes.Project,
    stats: PropTypes.array,
  },

  render() {
    let {project} = this.props;
    let stats = this.props.stats || project.stats;
    let chartData =
      stats &&
      stats.map(point => {
        return {x: point[0], y: point[1]};
      });

    return (
      <div>
        {chartData && (
          <LazyLoad height={25} debounce={50}>
            <BarChart height={25} points={chartData} label="events" />
          </LazyLoad>
        )}
      </div>
    );
  },
});

export default ProjectStatsGraph;
