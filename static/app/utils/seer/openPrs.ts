import {useOrganization} from 'sentry/utils/useOrganization';

export function useShowOpenPrs() {
  const organization = useOrganization();
  return organization.features.includes('autofix-single-run');
}
