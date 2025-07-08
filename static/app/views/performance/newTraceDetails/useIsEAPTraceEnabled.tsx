import useOrganization from 'sentry/utils/useOrganization';

export function useIsEAPTraceEnabled() {
  const organization = useOrganization();

  return organization.features.includes('trace-spans-format');
}
