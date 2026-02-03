import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';

export function useHasDrillDownFlows() {
  const organization = useOrganization();
  return hasDrillDownFlowsFeature(organization);
}

function hasDrillDownFlowsFeature(organization: Organization) {
  return organization.features.includes('dashboards-drilldown-flow');
}
