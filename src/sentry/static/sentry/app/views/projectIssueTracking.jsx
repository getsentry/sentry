import React from 'react';
import PluginConfig from '../components/pluginConfig';

const ProjectIssueTracking = React.createClass({
  propTypes: {
    organization: React.PropTypes.object.isRequired,
    project: React.PropTypes.object.isRequired,
    dataList: React.PropTypes.array.isRequired
  },

  render() {
    if (!this.props.dataList.length) {
      return null;
    }

    return (
      <div>
        {this.props.dataList.map((data) => {
          return <PluginConfig data={data} {...this.props} key={data.id} />;
        })}
      </div>
    );
  }
});

export default ProjectIssueTracking;
