import useOrganization from 'sentry/utils/useOrganization';

export default function useHasPlatformizedNextJsOverview() {
  const organization = useOrganization();

  return organization.features.includes(
    'insights-nextjs-frontend-overview-dashboard-migration'
  );
}
