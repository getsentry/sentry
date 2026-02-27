import useOrganization from 'sentry/utils/useOrganization';

export function useHasMetricUnitsUI() {
  const organization = useOrganization();
  return organization.features.includes('tracemetrics-units-ui');
}
