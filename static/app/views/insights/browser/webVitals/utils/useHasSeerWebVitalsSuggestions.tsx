import useOrganization from 'sentry/utils/useOrganization';

export function useHasSeerWebVitalsSuggestions() {
  const organization = useOrganization();

  return organization.features.includes('performance-web-vitals-seer-suggestions');
}
