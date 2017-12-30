import React from 'react';
import {Link} from 'react-router';

import withPlugins from '../../utils/withPlugins';

const PluginNavigation = React.createClass({
  render() {
    let {urlRoot, plugins} = this.props;

    if (!plugins || !plugins.plugins) return null;
    let enabledPlugins = plugins.plugins.filter(p => p.enabled && p.hasConfiguration);

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

export default withPlugins(PluginNavigation);
