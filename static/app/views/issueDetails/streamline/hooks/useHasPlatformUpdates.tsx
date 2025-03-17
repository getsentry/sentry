import useOrganization from 'sentry/utils/useOrganization';

export function useHasPlatformUpdates() {
  const organization = useOrganization();
  return organization.features.includes('issue-details-platform-updates');
}
