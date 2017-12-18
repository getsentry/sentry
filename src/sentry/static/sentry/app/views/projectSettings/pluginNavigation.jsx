import React from 'react';
import Reflux from 'reflux';

import PluginsStore from '../../stores/pluginsStore';

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
        {enabledPlugins.map(({id, name}) => (
          <li key={id}>
            <a href={`${urlRoot}/plugins/${id}/`}>{name}</a>
          </li>
        ))}
      </div>
    );
  },
});

export default PluginNavigation;
