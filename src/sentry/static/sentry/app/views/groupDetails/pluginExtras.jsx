import React from 'react';

const PluginExtras = React.createClass({
  propTypes: {
    pluginExtras: React.PropTypes.object.isRequired
  },

  render() {
    let pluginExtras = this.props.pluginExtras;
    return (
      <div className="plugin-extras">
        <ul className="mini-tag-list">
          <li>{pluginExtras.label + ' Assignee: ' + (pluginExtras.assignee || 'unassigned')}</li>
          <li>{pluginExtras.label + ' Status: ' + pluginExtras.status}</li>
        </ul>
      </div>
    );
  }
});

export default PluginExtras;
