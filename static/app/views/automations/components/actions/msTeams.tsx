import {tct} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {IntegrationField} from 'sentry/views/automations/components/actions/integrationField';
import {TargetDisplayField} from 'sentry/views/automations/components/actions/targetDisplayField';
import {ICON_SIZE} from 'sentry/views/automations/components/automationBuilderRow';

export default function MSTeamsNode() {
  return tct('Send a [logo] Microsoft Teams notification to [team] Team, to [channel]', {
    logo: <PluginIcon pluginId="msteams" size={ICON_SIZE} />,
    team: <IntegrationField />,
    channel: <TargetDisplayField />,
  });
}
