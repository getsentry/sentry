import PropTypes from 'prop-types';
import React from 'react';
import PluginConfig from '../components/pluginConfig';

const ProjectIssueTracking = React.createClass({
  propTypes: {
    organization: PropTypes.object.isRequired,
    project: PropTypes.object.isRequired,
    dataList: PropTypes.array.isRequired
  },

  render() {
    if (!this.props.dataList.length) {
      return null;
    }

    return (
      <div>
        {this.props.dataList.map(data => {
          return <PluginConfig data={data} {...this.props} key={data.id} />;
        })}
      </div>
    );
  }
});

export default ProjectIssueTracking;
