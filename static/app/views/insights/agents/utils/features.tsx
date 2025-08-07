import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import type {Organization} from 'sentry/types/organization';

type InsightsFeaturePropsWithoutFeatures = Omit<
  Parameters<typeof Feature>[0],
  'features'
>;

export function hasAgentInsightsFeature(organization: Organization) {
  return organization.features.includes('agents-insights');
}

export function hasMCPInsightsFeature(organization: Organization) {
  return organization.features.includes('mcp-insights');
}

export function AIInsightsFeature(props: InsightsFeaturePropsWithoutFeatures) {
  return (
    <Feature
      features={['agents-insights']}
      renderDisabled={props.renderDisabled ?? NoAccess}
    >
      {props.children}
    </Feature>
  );
}

export function McpInsightsFeature(props: InsightsFeaturePropsWithoutFeatures) {
  return (
    <Feature
      features={['mcp-insights']}
      renderDisabled={props.renderDisabled ?? NoAccess}
    >
      {props.children}
    </Feature>
  );
}
