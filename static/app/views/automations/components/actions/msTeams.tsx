import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {t, tct} from 'sentry/locale';
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

  return tct('Send a [logo] Microsoft Teams notification to [team] team, to [channel]', {
    logo: ActionMetadata[ActionType.MSTEAMS]?.icon,
    team: integrationName,
    channel: String(action.config.target_identifier),
  });
}

export function MSTeamsNode() {
  return tct('Send a [logo] Microsoft Teams notification to [team] team, to [channel]', {
    logo: ActionMetadata[ActionType.MSTEAMS]?.icon,
    team: <IntegrationField />,
    channel: <TargetDisplayField />,
  });
}

export function validateMSTeamsAction(action: Action): string | undefined {
  if (!action.integrationId) {
    return t('You must specify a Microsoft Teams team.');
  }
  if (!action.config.target_display) {
    return t('You must specify a channel.');
  }
  return undefined;
}
