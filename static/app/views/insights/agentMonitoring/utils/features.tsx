import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import type {Organization} from 'sentry/types/organization';

export function hasAgentInsights(organization: Organization) {
  return organization.features.includes('agent-insights');
}

type AgentInsightsFeatureProps = Omit<Parameters<typeof Feature>[0], 'features'>;

export function AgentInsightsFeature(props: AgentInsightsFeatureProps) {
  return (
    <Feature features="agent-insights" renderDisabled={props.renderDisabled ?? NoAccess}>
      {props.children}
    </Feature>
  );
}
