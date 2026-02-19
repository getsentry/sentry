import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';

export default function useHasPlatformizedNextJsOverview() {
  const organization = useOrganization();

  return hasPlatformizedNextJsOverviewWidget(organization);
}

export function hasPlatformizedNextJsOverviewWidget(organization: Organization) {
  return organization.features.includes(
    'insights-nextjs-frontend-overview-dashboard-migration'
  );
}
