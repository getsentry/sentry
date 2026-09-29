import {cloneElement, Fragment} from 'react';

import {t} from 'sentry/locale';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
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
        {navWithHooks.map((config, index) => (
          <Fragment key={config.name}>
            {index > 0 && <SecondaryNavigation.Separator />}
            <SettingsNavigationGroup {...otherProps} {...config} />
          </Fragment>
        ))}
        {hooks.map((Hook, i) => cloneElement(Hook, {key: `hook-${i}`}))}
      </SecondaryNavigation.Body>
    </Fragment>
  );
}

export function SettingsNavigation({
  hooks = [],
  hookConfigs = [],
  ...props
}: Props) {
  return (
    <ErrorBoundary customComponent={null}>
      <SettingsSecondaryNavigation
        hooks={hooks}
        hookConfigs={hookConfigs}
        {...props}
      />
    </ErrorBoundary>
  );
}
