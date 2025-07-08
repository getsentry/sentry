import {Flex} from 'sentry/components/core/layout';
import ExternalLink from 'sentry/components/links/externalLink';
import {AutomationBuilderInput} from 'sentry/components/workflowEngine/form/automationBuilderInput';
import {
  OptionalRowLine,
  RowLine,
} from 'sentry/components/workflowEngine/form/automationBuilderRowLine';
import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {DismissableInfoAlert} from 'sentry/components/workflowEngine/ui/dismissableInfoAlert';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Action, ActionHandler} from 'sentry/types/workflowEngine/actions';
import {ActionType} from 'sentry/types/workflowEngine/actions';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';
import {IntegrationField} from 'sentry/views/automations/components/actions/integrationField';
import {TagsField} from 'sentry/views/automations/components/actions/tagsField';
import {TargetDisplayField} from 'sentry/views/automations/components/actions/targetDisplayField';

export function SlackDetails({
  action,
  handler,
}: {
  action: Action;
  handler: ActionHandler;
}) {
  const integrationName =
    handler.integrations?.find(i => i.id === action.integrationId)?.name ||
    action.integrationId;

  return tct(
    'Send a [logo] Slack message to [workspace] workspace, to [channel][tagsAndNotes]',
    {
      logo: ActionMetadata[ActionType.SLACK]?.icon,
      workspace: integrationName,
      channel: action.config.target_display
        ? `${action.config.target_display}`
        : action.config.target_identifier,
      tagsAndNotes: SlackTagsAndNotes(action),
    }
  );
}

function SlackTagsAndNotes(action: Action) {
  const notes = String(action.data.notes);
  const tags = String(action.data.tags);

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
    <Flex direction="column" gap={space(1)} flex="1">
      <RowLine>
        {tct('Send a [logo] Slack message to [workspace] workspace, to [channel]', {
          logo: ActionMetadata[ActionType.SLACK]?.icon,
          workspace: <IntegrationField />,
          channel: <TargetDisplayField placeholder={t('channel name or ID')} />,
        })}
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
      placeholder={t('example notes')}
      value={action.data.notes}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({
          data: {...action.data, notes: e.target.value},
        });
      }}
    />
  );
}
