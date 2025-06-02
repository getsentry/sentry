import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

// IMPORTANT:
// This hook and the prefersStackedNav function NEED to have the same logic.
// Make sure to update both if you are changing this logic.

export function usePrefersStackedNav() {
  const user = useUser();
  const organization = useOrganization({allowNull: true});
  const userStackedNavOption = user?.options?.prefersStackedNavigation;

  if (
    userStackedNavOption !== false &&
    organization?.features.includes('enforce-stacked-navigation')
  ) {
    return true;
  }

  return userStackedNavOption ?? false;
}
