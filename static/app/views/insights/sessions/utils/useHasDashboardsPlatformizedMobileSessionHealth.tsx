import useOrganization from 'sentry/utils/useOrganization';

export default function useHasDashboardsPlatformizedMobileSessionHealth() {
  const organization = useOrganization();

  return organization.features.includes(
    'insights-mobile-session-health-dashboard-migration'
  );
}
