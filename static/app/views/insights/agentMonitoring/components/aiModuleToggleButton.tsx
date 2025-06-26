import styled from '@emotion/styled';

import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconLab} from 'sentry/icons';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {
  hasAgentInsightsFeature,
  useTogglePreferedAiModule,
} from 'sentry/views/insights/agentMonitoring/utils/features';

export function AiModuleToggleButton() {
  const [preferedAiModule, togglePreferedModule] = useTogglePreferedAiModule();
  const organization = useOrganization();

  const handleAction = () => {
    const isEnabled = preferedAiModule !== 'agents-insights';

    trackAnalytics('agent-monitoring.ui-toggle', {
      organization,
      enabled: isEnabled,
    });
    togglePreferedModule();
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
      items={[
        {
          key: 'ai-module',
          leadingItems:
            preferedAiModule === 'agents-insights' ? null : <IconLab isSolid />,
          onAction: handleAction,
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
