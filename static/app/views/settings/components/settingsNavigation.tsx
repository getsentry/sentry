import {cloneElement, Fragment} from 'react';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {SettingsNavigationGroup} from 'sentry/views/settings/components/settingsNavigationGroup';
import type {NavigationProps, NavigationSection} from 'sentry/views/settings/types';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

type Props = NavigationProps & {
  /**
   * Additional navigation configuration driven by hooks
   */
  hookConfigs: NavigationSection[];
  /**
   * Additional navigation elements driven from hooks
   */
  hooks: React.ReactElement[];
  /**
   * The configuration for this navigation panel
   */
  navigationObjects: NavigationSection[];
};

export function SettingsNavigation({
  navigationObjects,
  hookConfigs,
  hooks,
  ...otherProps
}: Props) {
  const navWithHooks = navigationObjects.concat(hookConfigs);
  const location = useLocation();
  const settingsV3 = useSettingsV3();
  const title = settingsV3
    ? location.pathname.startsWith('/settings/account/')
      ? t('Account Settings')
      : otherProps.organization &&
          location.pathname.startsWith(
            `/settings/${otherProps.organization.slug}/projects/`
          )
        ? t('Project Settings')
        : t('Organization Settings')
    : t('Settings');

  return (
    <ErrorBoundary customComponent={null}>
      <SecondaryNavigation.Header>{title}</SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        {navWithHooks.map((config, index) => (
          <Fragment key={config.name}>
            {index > 0 && <SecondaryNavigation.Separator />}
            <SettingsNavigationGroup {...otherProps} {...config} />
          </Fragment>
        ))}
        {hooks.map((Hook, i) => cloneElement(Hook, {key: `hook-${i}`}))}
      </SecondaryNavigation.Body>
    </ErrorBoundary>
  );
}
