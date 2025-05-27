import {Flex} from 'sentry/components/container/flex';
import AutomationBuilderInputField from 'sentry/components/workflowEngine/form/automationBuilderInputField';
import {
  OptionalRowLine,
  RowLine,
} from 'sentry/components/workflowEngine/form/automationBuilderRowLine';
import {ActionMetadata} from 'sentry/components/workflowEngine/ui/actionMetadata';
import {BannerLink, InfoBanner} from 'sentry/components/workflowEngine/ui/infoBanner';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ActionType} from 'sentry/types/workflowEngine/actions';
import {useActionNodeContext} from 'sentry/views/automations/components/actionNodes';
import {IntegrationField} from 'sentry/views/automations/components/actions/integrationField';
import {TagsField} from 'sentry/views/automations/components/actions/tagsField';
import {TargetDisplayField} from 'sentry/views/automations/components/actions/targetDisplayField';

export function SlackNode() {
  return (
    <Flex column gap={space(1)} flex="1">
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
      <InfoBanner>
        <Flex gap={space(0.5)}>
          {tct(
            'Having rate limiting problems? Enter a channel or user ID. Get help [link:here]',
            {
              link: (
                <BannerLink href="https://docs.sentry.io/organization/integrations/notification-incidents/slack/#rate-limiting-error" />
              ),
            }
          )}
        </Flex>
      </InfoBanner>
    </Flex>
  );
}

function NotesField() {
  const {action, actionId, onUpdate} = useActionNodeContext();
  return (
    <AutomationBuilderInputField
      name={`${actionId}.data.notes`}
      placeholder={t('example notes')}
      value={action.data.tags}
      onChange={(value: string) => {
        onUpdate({
          tags: value,
        });
      }}
    />
  );
}
