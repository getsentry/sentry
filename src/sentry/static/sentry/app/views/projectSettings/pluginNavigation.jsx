import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';

import PluginsStore from '../../stores/pluginsStore';

class PluginNavigationItem extends React.PureComponent {
  static propTypes = {
    urlRoot: PropTypes.string,
    id: PropTypes.string,
    name: PropTypes.string,
  };
  render() {
    let {urlRoot, id, name} = this.props;
    return (
      <li>
        <a href={`${urlRoot}/plugins/${id}/`}>{name}</a>
      </li>
    );
  }
}

const PluginNavigation = React.createClass({
  mixins: [Reflux.connect(PluginsStore, 'store')],

  render() {
    let {store} = this.state;
    let {urlRoot} = this.props;

    if (!store || !store.plugins) return null;
    let enabledPlugins = store.plugins.filter(p => p.enabled && p.hasConfiguration);

    if (!enabledPlugins.length) return null;

    return (
      <div>
        {enabledPlugins.map(plugin => (
          <PluginNavigationItem key={plugin.id} urlRoot={urlRoot} {...plugin} />
        ))}
      </div>
    );
  },
});

export default PluginNavigation;
