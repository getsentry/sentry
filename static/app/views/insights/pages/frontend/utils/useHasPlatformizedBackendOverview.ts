import useOrganization from 'sentry/utils/useOrganization';

export default function useHasPlatformizedBackendOverview() {
  const organization = useOrganization();

  return organization.features.includes('insights-backend-overview-dashboard-migration');
}
