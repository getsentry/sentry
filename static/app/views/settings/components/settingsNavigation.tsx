import {cloneElement, Component, Fragment} from 'react';
import * as Sentry from '@sentry/react';

import {t} from 'sentry/locale';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {SettingsNavigationGroup} from 'sentry/views/settings/components/settingsNavigationGroup';
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
    <Fragment>
      <SecondaryNavigation.Header>{t('Settings')}</SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        {navWithHooks.map(config => (
          <SettingsNavigationGroup key={config.name} {...otherProps} {...config} />
        ))}
        {hooks.map((Hook, i) => cloneElement(Hook, {key: `hook-${i}`}))}
      </SecondaryNavigation.Body>
    </Fragment>
  );
}

export class SettingsNavigation extends Component<Props> {
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
      ...otherProps
    } = this.props;

    return (
      <SettingsSecondaryNavigation
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
