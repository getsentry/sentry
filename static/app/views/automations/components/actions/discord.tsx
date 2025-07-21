import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {
  OptionalRowLine,
  RowLine,
} from 'sentry/components/workflowEngine/form/automationBuilderRowLine';
import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {DismissableInfoAlert} from 'sentry/components/workflowEngine/ui/dismissableInfoAlert';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  type Action,
  type ActionHandler,
  ActionType,
} from 'sentry/types/workflowEngine/actions';
import {IntegrationField} from 'sentry/views/automations/components/actions/integrationField';
import {TagsField} from 'sentry/views/automations/components/actions/tagsField';
import {TargetDisplayField} from 'sentry/views/automations/components/actions/targetDisplayField';

export function DiscordDetails({
  action,
  handler,
}: {
  action: Action;
  handler: ActionHandler;
}) {
  const integrationName =
    handler.integrations?.find(i => i.id === action.integrationId)?.name ||
    action.integrationId;
  const tags = String(action.data.tags);

  return tct(
    'Send a [logo] Discord message to [server] server, to channel with ID or URL [channel][tags]',
    {
      logo: ActionMetadata[ActionType.DISCORD]?.icon,
      server: integrationName,
      channel: String(action.config.target_identifier),
      tags: action.data.tags ? `, and in the message show tags [${tags}]` : null,
    }
  );
}

export function DiscordNode() {
  return (
    <Flex direction="column" gap={space(1)} flex="1">
      <RowLine>
        {tct('Send a [logo] Discord message to [server] server, to [channel]', {
          logo: ActionMetadata[ActionType.DISCORD]?.icon,
          server: <IntegrationField />,
          channel: <TargetDisplayField placeholder={t('channel ID or URL')} />,
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

export function validateDiscordAction(action: Action): string | undefined {
  if (!action.integrationId) {
    return t('You must specify a Discord server.');
  }
  if (!action.config.target_display) {
    return t('You must specify a channel ID or URL.');
  }
  return undefined;
}
