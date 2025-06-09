import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {tct} from 'sentry/locale';
import type {Action, ActionHandler} from 'sentry/types/workflowEngine/actions';
import {ActionType} from 'sentry/types/workflowEngine/actions';
import {IntegrationField} from 'sentry/views/automations/components/actions/integrationField';
import {TicketActionSettingsButton} from 'sentry/views/automations/components/actions/ticketActionSettingsButton';

export function GithubEnterpriseDetails({
  action,
  handler,
}: {
  action: Action;
  handler: ActionHandler;
}) {
  const integrationName =
    handler.integrations?.find(i => i.id === action.integrationId)?.name ||
    action.integrationId;

  return tct('Create a [logo] GitHub Enterprise issue in [integration]', {
    logo: ActionMetadata[ActionType.GITHUB_ENTERPRISE]?.icon,
    integration: integrationName,
  });
}

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
