import type {Key} from 'react';
import styled from '@emotion/styled';

import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconLab} from 'sentry/icons';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {
  hasAgentInsightsFeature,
  usePreferedAiModule,
} from 'sentry/views/insights/agentMonitoring/utils/features';

export function AiModuleToggleButton() {
  const {mutate: mutateUserOptions} = useMutateUserOptions();
  const preferedAiModule = usePreferedAiModule();
  const navigate = useNavigate();
  const organization = useOrganization();

  const togglePreferedModule = () => {
    const prefersAgentsInsightsModule = preferedAiModule === 'agents-insights';
    const newPrefersAgentsInsightsModule = !prefersAgentsInsightsModule;
    mutateUserOptions({
      ['prefersAgentsInsightsModule']: newPrefersAgentsInsightsModule,
    });

    return newPrefersAgentsInsightsModule;
  };

  const handleExperimentDropdownAction = (key: Key) => {
    if (key === 'ai-module') {
      const prefersAgentsInsightsModule = togglePreferedModule();
      if (prefersAgentsInsightsModule) {
        navigate('/insights/agents');
      } else {
        navigate('/insights/ai/llm-monitoring');
      }
    }
  };

  if (!hasAgentInsightsFeature(organization)) {
    return null;
  }

  return (
    <DropdownMenu
      trigger={triggerProps => (
        <StyledDropdownButton {...triggerProps} size={'sm'}>
          {/* Passing icon as child to avoid extra icon margin */}
          <IconLab isSolid />
        </StyledDropdownButton>
      )}
      onAction={handleExperimentDropdownAction}
      items={[
        {
          key: 'ai-module',
          leadingItems:
            preferedAiModule === 'agents-insights' ? null : <IconLab isSolid />,
          label:
            preferedAiModule === 'agents-insights'
              ? 'Switch to LLM Monitoring'
              : 'Switch to Agents Insights',
        },
      ]}
      position="bottom-end"
    />
  );
}

const StyledDropdownButton = styled(DropdownButton)`
  color: ${p => p.theme.button.primary.background};
  :hover {
    color: ${p => p.theme.button.primary.background};
  }
`;
