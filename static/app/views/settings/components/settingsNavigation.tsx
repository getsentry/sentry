import {cloneElement, Component, Fragment} from 'react';
import * as Sentry from '@sentry/react';

import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import type {PrimaryNavGroup} from 'sentry/views/nav/types';
import SettingsNavigationGroup from 'sentry/views/settings/components/settingsNavigationGroup';
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
    /**
     * The primary navigation group for this settings page
     */
    primaryNavGroup: PrimaryNavGroup;
  };

function SettingsSecondaryNavigation({
  navigationObjects,
  hookConfigs,
  hooks,
  primaryNavGroup,
  ...otherProps
}: Props) {
  const navWithHooks = navigationObjects.concat(hookConfigs);

  return (
    <Fragment>
      <SecondaryNav.Header>
        {PRIMARY_NAV_GROUP_CONFIG[primaryNavGroup].label}
      </SecondaryNav.Header>
      <SecondaryNav.Body>
        {navWithHooks.map(config => (
          <SettingsNavigationGroup key={config.name} {...otherProps} {...config} />
        ))}
        {hooks.map((Hook, i) => cloneElement(Hook, {key: `hook-${i}`}))}
      </SecondaryNav.Body>
    </Fragment>
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
    const {
      navigationObjects,
      hooks,
      hookConfigs,
      stickyTop,
      organization,
      primaryNavGroup,
      ...otherProps
    } = this.props;

    return (
      <SettingsSecondaryNavigation
        primaryNavGroup={primaryNavGroup}
        navigationObjects={navigationObjects}
        hooks={hooks}
        hookConfigs={hookConfigs}
        stickyTop={stickyTop}
        organization={organization}
        {...otherProps}
      />
    );
  }
}

export default SettingsNavigation;
