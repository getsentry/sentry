import {Flex} from 'sentry/components/container/flex';
import {BannerLink, InfoBanner} from 'sentry/components/workflowEngine/ui/infoBanner';
import {t, tct} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';
import {IntegrationField} from 'sentry/views/automations/components/actions/integrationField';
import {TagsField} from 'sentry/views/automations/components/actions/tagsField';
import {TargetDisplayField} from 'sentry/views/automations/components/actions/targetDisplayField';
import {
  ICON_SIZE,
  OptionalRowLine,
  RowLine,
} from 'sentry/views/automations/components/automationBuilderRow';

export default function DiscordNode() {
  return (
    <Flex column gap={space(1)} flex="1">
      <RowLine>
        {tct('Send a [logo] Discord message to [server] server, to [channel]', {
          logo: <PluginIcon pluginId="discord" size={ICON_SIZE} />,
          server: <IntegrationField />,
          channel: <TargetDisplayField placeholder={t('channel ID or URL')} />,
        })}
      </RowLine>
      <OptionalRowLine>
        {tct('Optional: in the message show tags [tags]', {tags: <TagsField />})}
      </OptionalRowLine>
      <InfoBanner>
        <Flex gap={space(0.5)}>
          {tct(
            'Note that you must enter a Discord channel ID, not a channel name. Get help [link:here]',
            {
              link: (
                <BannerLink href="https://docs.sentry.io/organization/integrations/notification-incidents/discord/#issue-alerts" />
              ),
            }
          )}
        </Flex>
      </InfoBanner>
    </Flex>
  );
}
