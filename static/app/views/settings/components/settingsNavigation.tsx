import {cloneElement, Component} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {NAV_GROUP_LABELS} from 'sentry/components/nav/constants';
import {prefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
import {SecondaryNav} from 'sentry/components/nav/secondary';
import {PrimaryNavGroup} from 'sentry/components/nav/types';
import {space} from 'sentry/styles/space';
import SettingsNavigationGroup from 'sentry/views/settings/components/settingsNavigationGroup';
import SettingsNavigationGroupDeprecated from 'sentry/views/settings/components/settingsNavigationGroupDeprecated';
import type {NavigationProps, NavigationSection} from 'sentry/views/settings/types';

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

function SettingsSecondaryNavigation({
  navigationObjects,
  hookConfigs,
  hooks,
  ...otherProps
}: Props) {
  const navWithHooks = navigationObjects.concat(hookConfigs);

  return (
    <SecondaryNav group={PrimaryNavGroup.SETTINGS}>
      <SecondaryNav.Header>
        {NAV_GROUP_LABELS[PrimaryNavGroup.SETTINGS]}
      </SecondaryNav.Header>
      <SecondaryNav.Body>
        {navWithHooks.map(config => (
          <SettingsNavigationGroup key={config.name} {...otherProps} {...config} />
        ))}
        {hooks.map((Hook, i) => cloneElement(Hook, {key: `hook-${i}`}))}
      </SecondaryNav.Body>
    </SecondaryNav>
  );
}

class SettingsNavigation extends Component<Props> {
  static defaultProps: DefaultProps = {
    hooks: [],
    hookConfigs: [],
    stickyTop: '69px',
  };

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.withScope(scope => {
      Object.keys(errorInfo).forEach(key => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        scope.setExtra(key, errorInfo[key]);
      });
      scope.setExtra('url', window.location.href);
      Sentry.captureException(error);
    });
  }

  render() {
    const {navigationObjects, hooks, hookConfigs, stickyTop, ...otherProps} = this.props;
    const navWithHooks = navigationObjects.concat(hookConfigs);

    if (prefersStackedNav()) {
      return (
        <SettingsSecondaryNavigation
          navigationObjects={navigationObjects}
          hooks={hooks}
          hookConfigs={hookConfigs}
          stickyTop={stickyTop}
          {...otherProps}
        />
      );
    }

    return (
      <PositionStickyWrapper stickyTop={stickyTop}>
        {navWithHooks.map(config => (
          <SettingsNavigationGroupDeprecated
            key={config.name}
            {...otherProps}
            {...config}
          />
        ))}
        {hooks.map((Hook, i) => cloneElement(Hook, {key: `hook-${i}`}))}
      </PositionStickyWrapper>
    );
  }
}

const PositionStickyWrapper = styled('div')<{stickyTop: string}>`
  padding: ${space(4)};
  padding-right: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
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
