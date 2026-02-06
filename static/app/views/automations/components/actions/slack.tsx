import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {AutomationBuilderInput} from 'sentry/components/workflowEngine/form/automationBuilderInput';
import {
  OptionalRowLine,
  RowLine,
} from 'sentry/components/workflowEngine/form/automationBuilderRowLine';
import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {DismissableInfoAlert} from 'sentry/components/workflowEngine/ui/dismissableInfoAlert';
import {t, tct} from 'sentry/locale';
import type {Action, ActionHandler} from 'sentry/types/workflowEngine/actions';
import {ActionType} from 'sentry/types/workflowEngine/actions';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';
import {IntegrationField} from 'sentry/views/automations/components/actions/integrationField';
import {TagsField} from 'sentry/views/automations/components/actions/tagsField';
import {
  TargetDisplayField,
  TargetIdentifierField,
} from 'sentry/views/automations/components/actions/targetDisplayField';

export function SlackDetails({
  action,
  handler,
}: {
  action: Action;
  handler: ActionHandler;
}) {
  const integrationName =
    handler.integrations?.find(i => i.id === action.integrationId)?.name || t('unknown');

  return tct(
    'Send a [logo] Slack message to [workspace] workspace, to [channel][tagsAndNotes]',
    {
      logo: ActionMetadata[ActionType.SLACK]?.icon,
      workspace: integrationName,
      channel: action.config.targetDisplay || action.config.targetIdentifier,
      tagsAndNotes: SlackTagsAndNotes(action),
    }
  );
}

function SlackTagsAndNotes(action: Action) {
  const notes = action.data.notes;
  const tags = action.data.tags;

  if (notes && tags) {
    return tct(', and in the message show tags [tags] and notes [notes]', {tags, notes});
  }
  if (tags) {
    return tct(', and in the message show tags [tags]', {tags});
  }
  if (notes) {
    return tct(', and in the message show notes [notes]', {notes});
  }
  return null;
}

export function SlackNode() {
  return (
    <Flex direction="column" gap="md" flex="1">
      <RowLine>
        {tct(
          'Send a [logo] Slack message to the [workspace] workspace, to [channel] (optionally, an ID: [channel_id])',
          {
            logo: ActionMetadata[ActionType.SLACK]?.icon,
            workspace: <IntegrationField />,
            channel: <TargetDisplayField placeholder={t('e.g., #critical, Jane')} />,
            channel_id: <TargetIdentifierField placeholder={t('e.g., CA2FRA079')} />,
          }
        )}
      </RowLine>
      <OptionalRowLine>
        {tct('Optional: in the message show tags [tags] and notes [notes]', {
          tags: <TagsField />,
          notes: <NotesField />,
        })}
      </OptionalRowLine>
      <DismissableInfoAlert>
        {tct(
          'Having rate limiting problems? Enter a channel or user ID. Get help [link:here].',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/organization/integrations/notification-incidents/slack/#rate-limiting-error" />
            ),
          }
        )}
      </DismissableInfoAlert>
    </Flex>
  );
}

function NotesField() {
  const {action, actionId, onUpdate} = useActionNodeContext();
  return (
    <AutomationBuilderInput
      name={`${actionId}.data.notes`}
      aria-label={t('Notes')}
      placeholder={t('example notes')}
      value={action.data.notes ?? ''}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({
          data: {...action.data, notes: e.target.value},
        });
      }}
    />
  );
}

export function validateSlackAction(action: Action): string | undefined {
  if (!action.integrationId) {
    return t('You must specify a Slack workspace.');
  }
  if (!action.config.targetDisplay && !action.config.targetIdentifier) {
    return t('You must specify a channel name or ID.');
  }
  return undefined;
}
