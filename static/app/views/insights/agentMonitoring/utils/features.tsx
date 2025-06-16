import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import type {Organization} from 'sentry/types/organization';

type AgentInsightsFeatureProps = Omit<Parameters<typeof Feature>[0], 'features'>;

export function hasAgentInsightsFeature(organization: Organization) {
  return organization.features.includes('agents-insights');
}

export function AgentInsightsFeature(props: AgentInsightsFeatureProps) {
  return (
    <Feature features="agents-insights" renderDisabled={props.renderDisabled ?? NoAccess}>
      {props.children}
    </Feature>
  );
}
