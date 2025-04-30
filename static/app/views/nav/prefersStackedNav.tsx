import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

// IMPORTANT:
// These two functions NEED to have the same logic. Make sure to update both if you are changing this logic.

export function prefersStackedNav(organization: Organization) {
  const userStackedNavOption = ConfigStore.get('user')?.options?.prefersStackedNavigation;

  if (
    userStackedNavOption !== false &&
    organization.features.includes('enforce-stacked-navigation')
  ) {
    return true;
  }

  return userStackedNavOption ?? false;
}

export function usePrefersStackedNav() {
  const user = useUser();
  const organization = useOrganization();
  const userStackedNavOption = user?.options?.prefersStackedNavigation;

  if (
    userStackedNavOption !== false &&
    organization.features.includes('enforce-stacked-navigation')
  ) {
    return true;
  }

  return userStackedNavOption ?? false;
}
