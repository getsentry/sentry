import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import {Link} from 'react-router';
import PropTypes from 'prop-types';

import PluginsStore from '../../stores/pluginsStore';

const PluginNavigation = createReactClass({
  displayName: 'PluginNavigation',
  propTypes: {
    urlRoot: PropTypes.string,
  },
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
            <Link to={`${urlRoot}/plugins/${id}/`}>{name}</Link>
          </li>
        ))}
      </div>
    );
  },
});

export default PluginNavigation;
