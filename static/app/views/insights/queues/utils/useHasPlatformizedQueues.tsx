import useOrganization from 'sentry/utils/useOrganization';

export function useHasPlatformizedQueues() {
  const organization = useOrganization();

  return organization.features.includes('insights-queue-dashboard-migration');
}
