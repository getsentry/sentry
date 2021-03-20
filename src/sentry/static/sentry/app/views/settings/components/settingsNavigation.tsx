import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import space from 'app/styles/space';
import SettingsNavigationGroup from 'app/views/settings/components/settingsNavigationGroup';
import {NavigationProps, NavigationSection} from 'app/views/settings/types';

type DefaultProps = {
  /**
   * Additional navigation configuration driven by hooks
   */
  hookConfigs: NavigationSection[];
  /**
   * Additional navigation elements driven from hooks
   */
  hooks: React.ReactElement[];
  /**
   * How far from the top of the page should the navigation be when stickied.
   */
  stickyTop: string;
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
    stickyTop: '69px',
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
    const {navigationObjects, hooks, hookConfigs, stickyTop, ...otherProps} = this.props;
    const navWithHooks = navigationObjects.concat(hookConfigs);

    return (
      <PositionStickyWrapper stickyTop={stickyTop}>
        {navWithHooks.map(config => (
          <SettingsNavigationGroup key={config.name} {...otherProps} {...config} />
        ))}
        {hooks.map((Hook, i) => React.cloneElement(Hook, {key: `hook-${i}`}))}
      </PositionStickyWrapper>
    );
  }
}

const PositionStickyWrapper = styled('div')<{stickyTop: string}>`
  padding: ${space(4)};
  padding-right: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    position: sticky;
    top: ${p => p.stickyTop};
    overflow: scroll;
    -ms-overflow-style: none;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }
`;

export default SettingsNavigation;
