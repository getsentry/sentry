import * as Sentry from '@sentry/browser';
import React from 'react';

import SettingsNavigationGroup from 'app/views/settings/components/settingsNavigationGroup';
import {NavigationSection, NavigationProps} from 'app/views/settings/types';

type Props = NavigationProps & {
  /**
   * The configuration for this navigation panel
   */
  navigationObjects: NavigationSection[];
  /**
   * Additional navigation configuration driven by hooks
   */
  hookConfigs: NavigationSection[];
  /**
   * Additional navigation elements driven from hooks
   */
  hooks: React.ReactElement[];
};

class SettingsNavigation extends React.Component<Props> {
  static defaultProps = {
    hooks: [],
    hookConfigs: [],
  };

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
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
      <div>
        {navWithHooks.map(config => (
          <SettingsNavigationGroup key={config.name} {...otherProps} {...config} />
        ))}
        {hooks.map((Hook, i) => React.cloneElement(Hook, {key: `hook-${i}`}))}
      </div>
    );
  }
}

export default SettingsNavigation;
