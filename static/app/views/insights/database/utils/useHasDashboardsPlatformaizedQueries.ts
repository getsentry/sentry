import useOrganization from 'sentry/utils/useOrganization';

export default function useHasDashboardsPlatformizedQueries() {
  const organization = useOrganization();

  return organization.features.includes('insights-queries-dashboard-migration');
}
