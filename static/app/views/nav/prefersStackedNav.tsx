import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

export function prefersStackedNav(organization: Organization) {
  return (
    organization.features.includes('enforce-stacked-sidenav') ??
    ConfigStore.get('user')?.options?.prefersStackedNavigation ??
    false
  );
}

export function usePrefersStackedNav() {
  const user = useUser();
  const organization = useOrganization();

  return (
    organization.features.includes('enforce-stacked-sidenav') ??
    user?.options?.prefersStackedNavigation ??
    false
  );
}
