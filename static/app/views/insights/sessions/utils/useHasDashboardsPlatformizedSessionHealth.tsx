import useOrganization from 'sentry/utils/useOrganization';

export default function useHasDashboardsPlatformizedSessionHealth() {
  const organization = useOrganization();

  return organization.features.includes(
    'organizations:performance-session-health-dashboard-migration'
  );
}
