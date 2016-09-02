import React from 'react';
import PluginConfig from '../components/pluginConfig';

const ProjectIssueTracking = React.createClass({
  propTypes: {
    organization: React.PropTypes.object.isRequired,
    project: React.PropTypes.object.isRequired,
    plugins: React.PropTypes.array.isRequired
  },

  render() {
    if (!this.props.plugins.length) {
      return null;
    }

    return (
      <div>
        {this.props.plugins.map((data) => {
          return <PluginConfig data={data} {...this.props} key={data.id} />;
        })}
      </div>
    );
  }
});

export default ProjectIssueTracking;
