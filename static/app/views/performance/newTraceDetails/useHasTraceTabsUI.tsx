import useOrganization from 'sentry/utils/useOrganization';

export function useHasTraceTabsUI() {
  const organization = useOrganization();

  return organization.features.includes('trace-tabs-ui');
}
