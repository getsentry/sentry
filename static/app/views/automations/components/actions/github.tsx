import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {tct} from 'sentry/locale';
import {ActionType} from 'sentry/types/workflowEngine/actions';
import {IntegrationField} from 'sentry/views/automations/components/actions/integrationField';
import {TicketActionSettingsButton} from 'sentry/views/automations/components/actions/ticketActionSettingsButton';

export function GithubNode() {
  return tct('Create a [logo] GitHub issue in [integration] with these [settings]', {
    logo: ActionMetadata[ActionType.GITHUB]?.icon,
    integration: <IntegrationField />,
    settings: <TicketActionSettingsButton />,
  });
}
