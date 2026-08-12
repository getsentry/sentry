import {useOrganization} from 'sentry/utils/useOrganization';

export function useHasNewBreadcrumbs() {
  const organization = useOrganization();
  return organization.features.includes('ui-migration-breadcrumbs');
}
