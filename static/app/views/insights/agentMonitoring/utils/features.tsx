import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';

type AgentInsightsFeatureProps = Omit<Parameters<typeof Feature>[0], 'features'>;

export function AgentInsightsFeature(props: AgentInsightsFeatureProps) {
  return (
    <Feature features="agents-insights" renderDisabled={props.renderDisabled ?? NoAccess}>
      {props.children}
    </Feature>
  );
}
