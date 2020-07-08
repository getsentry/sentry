import React from 'react';
import * as Sentry from '@sentry/react';
import styled from '@emotion/styled';

import SettingsNavigationGroup from 'app/views/settings/components/settingsNavigationGroup';
import {NavigationSection, NavigationProps} from 'app/views/settings/types';

type DefaultProps = {
  /**
   * Additional navigation configuration driven by hooks
   */
  hookConfigs: NavigationSection[];
  /**
   * Additional navigation elements driven from hooks
   */
  hooks: React.ReactElement[];
};

type Props = DefaultProps &
  NavigationProps & {
    /**
     * The configuration for this navigation panel
     */
    navigationObjects: NavigationSection[];
  };

class SettingsNavigation extends React.Component<Props> {
  static defaultProps: DefaultProps = {
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
      <PositionStickyWrapper>
        {navWithHooks.map(config => (
          <SettingsNavigationGroup key={config.name} {...otherProps} {...config} />
        ))}
        {hooks.map((Hook, i) => React.cloneElement(Hook, {key: `hook-${i}`}))}
      </PositionStickyWrapper>
    );
  }
}

const PositionStickyWrapper = styled('div')`
  position: sticky;
  top: 100px;
  overflow: scroll;
  height: calc(100vh - 98px);
`;

export default SettingsNavigation;
