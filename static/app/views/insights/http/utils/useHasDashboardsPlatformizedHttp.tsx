import useOrganization from 'sentry/utils/useOrganization';

export default function useHasDashboardsPlatformizedHttp() {
  const organization = useOrganization();

  return organization.features.includes('insights-http-dashboard-migration');
}
