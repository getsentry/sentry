import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {AutomationBuilderInput} from 'sentry/components/workflowEngine/form/automationBuilderInput';
import {
  OptionalRowLine,
  RowLine,
} from 'sentry/components/workflowEngine/form/automationBuilderRowLine';
import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {DismissableInfoAlert} from 'sentry/components/workflowEngine/ui/dismissableInfoAlert';
import {t, tct} from 'sentry/locale';
import {
  ActionType,
  type Action,
  type ActionHandler,
} from 'sentry/types/workflowEngine/actions';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';
import {IntegrationField} from 'sentry/views/automations/components/actions/integrationField';
import {TagsField} from 'sentry/views/automations/components/actions/tagsField';
import {useAutomationBuilderErrorContext} from 'sentry/views/automations/components/automationBuilderErrorContext';

export function DiscordDetails({
  action,
  handler,
}: {
  action: Action;
  handler: ActionHandler;
}) {
  const integrationName =
    handler.integrations?.find(i => i.id === action.integrationId)?.name || t('unknown');
  const tags = String(action.data.tags);

  return tct(
    'Send a [logo] Discord message to [server] server, to channel with ID or URL [channel][tags]',
    {
      logo: ActionMetadata[ActionType.DISCORD]?.icon,
      server: integrationName,
      channel: String(action.config.targetIdentifier),
      tags: action.data.tags ? `, and in the message show tags [${tags}]` : null,
    }
  );
}

export function DiscordNode() {
  return (
    <Flex direction="column" gap="md" flex="1">
      <RowLine>
        {tct('Send a [logo] Discord message to [server] server, to [channel]', {
          logo: ActionMetadata[ActionType.DISCORD]?.icon,
          server: <IntegrationField />,
          channel: <TargetIdentifierField />,
        })}
      </RowLine>
      <OptionalRowLine>
        {tct('Optional: in the message show tags [tags]', {tags: <TagsField />})}
      </OptionalRowLine>
      <DismissableInfoAlert>
        {tct(
          'Note that you must enter a Discord channel ID, not a channel name. Get help [link:here].',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/organization/integrations/notification-incidents/discord/#issue-alerts" />
            ),
          }
        )}
      </DismissableInfoAlert>
    </Flex>
  );
}

function TargetIdentifierField() {
  const {action, actionId, onUpdate} = useActionNodeContext();
  const {removeError} = useAutomationBuilderErrorContext();

  return (
    <AutomationBuilderInput
      name={`${actionId}.config.targetIdentifier`}
      placeholder={t('channel ID or URL')}
      value={action.config.targetIdentifier ?? ''}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({
          config: {...action.config, targetIdentifier: e.target.value},
        });
        removeError(action.id);
      }}
    />
  );
}

export function validateDiscordAction(action: Action): string | undefined {
  if (!action.integrationId) {
    return t('You must specify a Discord server.');
  }
  if (!action.config.targetIdentifier) {
    return t('You must specify a channel ID or URL.');
  }
  return undefined;
}
