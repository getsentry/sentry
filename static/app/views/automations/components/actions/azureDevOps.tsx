import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {tct} from 'sentry/locale';
import type {Action, ActionHandler} from 'sentry/types/workflowEngine/actions';
import {ActionType} from 'sentry/types/workflowEngine/actions';
import {IntegrationField} from 'sentry/views/automations/components/actions/integrationField';
import {TicketActionSettingsButton} from 'sentry/views/automations/components/actions/ticketActionSettingsButton';

export function AzureDevOpsDetails({
  action,
  handler,
}: {
  action: Action;
  handler: ActionHandler;
}) {
  const integrationName =
    handler.integrations?.find(i => i.id === action.integrationId)?.name ||
    action.integrationId;

  return tct('Create an [logo] Azure DevOps work item in [integration]', {
    logo: ActionMetadata[ActionType.AZURE_DEVOPS]?.icon,
    integration: integrationName,
  });
}

export function AzureDevOpsNode() {
  return tct(
    'Create an [logo] Azure DevOps work item in [integration] with these [settings]',
    {
      logo: ActionMetadata[ActionType.AZURE_DEVOPS]?.icon,
      integration: <IntegrationField />,
      settings: <TicketActionSettingsButton />,
    }
  );
}
