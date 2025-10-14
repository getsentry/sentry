import useOrganization from 'sentry/utils/useOrganization';

export function useHasDrillDownFlows() {
  const organization = useOrganization();
  return organization.features.includes('dashboards-drilldown-flow');
}
