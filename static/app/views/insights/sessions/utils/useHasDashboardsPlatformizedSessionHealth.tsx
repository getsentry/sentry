import useOrganization from 'sentry/utils/useOrganization';

export default function useHasDashboardsPlatformizedSessionHealth() {
  const organization = useOrganization();

  return organization.features.includes('performance-session-health-dashboard-migration');
}
