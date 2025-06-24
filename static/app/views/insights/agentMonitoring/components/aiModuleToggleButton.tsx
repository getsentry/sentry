import type {Key} from 'react';
import styled from '@emotion/styled';

import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconLab} from 'sentry/icons';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';
import useOrganization from 'sentry/utils/useOrganization';
import {
  hasAgentInsightsFeature,
  usePreferedAiModule,
} from 'sentry/views/insights/agentMonitoring/utils/features';

export function AiModuleToggleButton() {
  const {mutate: mutateUserOptions} = useMutateUserOptions();
  const preferedAiModule = usePreferedAiModule();
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
      togglePreferedModule();
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
              ? 'Switch to Old Experience'
              : 'Switch to New Experience',
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
