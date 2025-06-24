import {useState} from 'react';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import ExternalLink from 'sentry/components/links/externalLink';
import {
  OptionalRowLine,
  RowLine,
} from 'sentry/components/workflowEngine/form/automationBuilderRowLine';
import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {IconClose} from 'sentry/icons';
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
  const [dismissed, setDismissed] = useState(false);

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
      {dismissed ? null : (
        <Alert
          type="info"
          showIcon
          trailingItems={
            <Button
              aria-label="Dismiss banner"
              icon={<IconClose color="purple400" style={{padding: 0}} />}
              borderless
              onClick={() => setDismissed(true)}
              size="zero"
              style={{padding: 0}}
            />
          }
        >
          {tct(
            'Note that you must enter a Discord channel ID, not a channel name. Get help [link:here].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/organization/integrations/notification-incidents/discord/#issue-alerts" />
              ),
            }
          )}
        </Alert>
      )}
    </Flex>
  );
}
