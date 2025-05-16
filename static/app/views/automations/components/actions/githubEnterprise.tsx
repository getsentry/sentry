import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {tct} from 'sentry/locale';
import {ActionType} from 'sentry/types/workflowEngine/actions';
import {IntegrationField} from 'sentry/views/automations/components/actions/integrationField';
import {TicketActionSettingsButton} from 'sentry/views/automations/components/actions/ticketActionSettingsButton';

export function GithubEnterpriseNode() {
  return tct(
    'Create a [logo] GitHub Enterprise issue in [integration] with these [settings]',
    {
      logo: ActionMetadata[ActionType.GITHUB_ENTERPRISE]?.icon,
      integration: <IntegrationField />,
      settings: <TicketActionSettingsButton />,
    }
  );
}
