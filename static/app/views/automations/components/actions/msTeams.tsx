import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {tct} from 'sentry/locale';
import {
  type Action,
  type ActionHandler,
  ActionType,
} from 'sentry/types/workflowEngine/actions';
import {IntegrationField} from 'sentry/views/automations/components/actions/integrationField';
import {TargetDisplayField} from 'sentry/views/automations/components/actions/targetDisplayField';

export function MSTeamsDetails({
  action,
  handler,
}: {
  action: Action;
  handler: ActionHandler;
}) {
  const integrationName =
    handler.integrations?.find(i => i.id === action.integrationId)?.name ||
    action.integrationId;

  return tct('Send a [logo] Microsoft Teams notification to [team] Team, to [channel]', {
    logo: ActionMetadata[ActionType.MSTEAMS]?.icon,
    team: integrationName,
    channel: String(action.config.target_identifier),
  });
}

export function MSTeamsNode() {
  return tct('Send a [logo] Microsoft Teams notification to [team] Team, to [channel]', {
    logo: ActionMetadata[ActionType.MSTEAMS]?.icon,
    team: <IntegrationField />,
    channel: <TargetDisplayField />,
  });
}
