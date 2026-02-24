import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';

export default function useHasPlatformizedLaravelOverview() {
  const organization = useOrganization();

  return hasPlatformizedLaravelOverviewWidget(organization);
}

function hasPlatformizedLaravelOverviewWidget(organization: Organization) {
  return organization.features.includes('insights-laravel-overview-dashboard-migration');
}
