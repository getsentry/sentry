import React from 'react';

import createReactClass from 'create-react-class';
import {Link} from 'react-router';
import PropTypes from 'prop-types';

import withPlugins from '../../utils/withPlugins';
import SentryTypes from '../../proptypes';

const PluginNavigation = createReactClass({
  displayName: 'PluginNavigation',
  propTypes: {
    urlRoot: PropTypes.string,
    plugins: PropTypes.arrayOf(SentryTypes.PluginShape),
  },

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
