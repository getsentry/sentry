import useOrganization from 'sentry/utils/useOrganization';

export default function useHasPlatformizedFrontendOverview() {
  const organization = useOrganization();

  return organization.features.includes('insights-frontend-overview-dashboard-migration');
}
