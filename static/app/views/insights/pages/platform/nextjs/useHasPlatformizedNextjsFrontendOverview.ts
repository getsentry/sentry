import useOrganization from 'sentry/utils/useOrganization';

export default function useHasPlatformizedNextjsFrontendOverview() {
  const organization = useOrganization();

  return organization.features.includes(
    'insights-nextjs-frontend-overview-dashboard-migration'
  );
}
