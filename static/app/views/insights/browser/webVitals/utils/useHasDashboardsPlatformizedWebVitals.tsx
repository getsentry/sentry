import useOrganization from 'sentry/utils/useOrganization';

export default function useHasDashboardsPlatformizedWebVitals() {
  const organization = useOrganization();

  return organization.features.includes('performance-session-health-dashboard-migration');
}
