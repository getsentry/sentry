import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import type {Organization} from 'sentry/types/organization';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

type AgentInsightsFeatureProps = Omit<Parameters<typeof Feature>[0], 'features'>;

export function hasAgentInsightsFeature(organization: Organization) {
  return organization.features.includes('agents-insights');
}

export function hasMCPInsightsFeature(organization: Organization) {
  return organization.features.includes('mcp-insights');
}

export function usePreferedAiModule() {
  const organization = useOrganization();
  const user = useUser();

  if (!hasAgentInsightsFeature(organization)) {
    return 'llm-monitoring';
  }

  return user.options.prefersAgentsInsightsModule ? 'agents-insights' : 'llm-monitoring';
}

export function useTogglePreferedAiModule(): [string, () => void] {
  const preferedAiModule = usePreferedAiModule();
  const {mutate: mutateUserOptions} = useMutateUserOptions();

  const togglePreferedModule = () => {
    const prefersAgentsInsightsModule = preferedAiModule === 'agents-insights';
    const newPrefersAgentsInsightsModule = !prefersAgentsInsightsModule;
    mutateUserOptions({
      ['prefersAgentsInsightsModule']: newPrefersAgentsInsightsModule,
    });
  };

  return [preferedAiModule, togglePreferedModule];
}

export function AIInsightsFeature(props: AgentInsightsFeatureProps) {
  const preferedAiModule = usePreferedAiModule();

  return (
    <Feature
      features={preferedAiModule}
      renderDisabled={props.renderDisabled ?? NoAccess}
    >
      {props.children}
    </Feature>
  );
}
