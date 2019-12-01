import * as Sentry from '@sentry/browser';
import {Box} from 'reflexbox';
import PropTypes from 'prop-types';
import React from 'react';

import SettingsNavigationGroup from 'app/views/settings/components/settingsNavigationGroup';
import SentryTypes from 'app/sentryTypes';

class SettingsNavigation extends React.Component {
  static propTypes = {
    hooks: PropTypes.array,
    hookConfigs: PropTypes.array,
    navigationObjects: PropTypes.arrayOf(SentryTypes.NavigationObject).isRequired,
  };

  static defaultProps = {
    hooks: [],
    hookConfigs: [],
  };

  componentDidCatch(error, errorInfo) {
    Sentry.withScope(scope => {
      Object.keys(errorInfo).forEach(key => {
        scope.setExtra(key, errorInfo[key]);
      });
      scope.setExtra('url', window.location.href);
      Sentry.captureException(error);
    });
  }

  render() {
    const {navigationObjects, hooks, hookConfigs, ...otherProps} = this.props;
    const navWithHooks = navigationObjects.concat(hookConfigs);

    return (
      <Box>
        {navWithHooks.map(config => (
          <SettingsNavigationGroup key={config.name} {...otherProps} {...config} />
        ))}
        {hooks.map((Hook, i) =>
          React.cloneElement(Hook, {
            key: `hook-${i}`,
          })
        )}
      </Box>
    );
  }
}

export default SettingsNavigation;
