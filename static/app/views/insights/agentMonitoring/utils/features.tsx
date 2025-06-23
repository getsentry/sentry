import {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';

import Feature from 'sentry/components/acl/feature';
import {NoAccess} from 'sentry/components/noAccess';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {MODULE_BASE_URLS} from 'sentry/views/insights/common/utils/useModuleURL';
import {AGENTS_LANDING_SUB_PATH} from 'sentry/views/insights/pages/agents/settings';
import {AI_LANDING_SUB_PATH} from 'sentry/views/insights/pages/ai/settings';
import {INSIGHTS_BASE_URL} from 'sentry/views/insights/settings';
import {ModuleName} from 'sentry/views/insights/types';

type AgentInsightsFeatureProps = Omit<Parameters<typeof Feature>[0], 'features'>;

export function hasAgentInsightsFeature(organization: Organization) {
  return organization.features.includes('agents-insights');
}

export function usePreferedAiModule() {
  const organization = useOrganization();
  const user = useUser();

  if (!hasAgentInsightsFeature(organization)) {
    return 'llm-monitoring';
  }

  return user.options.prefersAgentsInsightsModule ? 'agents-insights' : 'llm-monitoring';
}

export function useRedirectToPreferedAiModule() {
  const preferedAiModule = usePreferedAiModule();
  const navigate = useNavigate();

  useEffect(() => {
    if (preferedAiModule === 'llm-monitoring') {
      navigate(
        `/${INSIGHTS_BASE_URL}/${AI_LANDING_SUB_PATH}/${MODULE_BASE_URLS[ModuleName.AI]}/`
      );
    } else if (preferedAiModule === 'agents-insights') {
      navigate(`/${INSIGHTS_BASE_URL}/${AGENTS_LANDING_SUB_PATH}/`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
