import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useHasPlatformizedInsights() {
  const organization = useOrganization();
  const location = useLocation();

  if (location.query.usePlatformizedView === '1') {
    return true;
  }

  return hasPlatformizedInsights(organization);
}

export function hasPlatformizedInsights(organization: Organization) {
  return organization.features.includes('insights-prebuilt-dashboards');
}
