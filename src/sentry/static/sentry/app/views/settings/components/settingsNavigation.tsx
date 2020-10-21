import * as React from 'react';
import * as Sentry from '@sentry/react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
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
  padding: ${space(4)};
  padding-right: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    position: sticky;
    top: 70px;
    overflow: scroll;
    height: calc(100vh - 70px);
    -ms-overflow-style: none;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }
`;

export default SettingsNavigation;
