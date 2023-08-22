import {IconGeneric, IconMail, IconSad, IconSentry} from 'sentry/icons';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {IssueAlertRuleAction} from 'sentry/types/alerts';

const STATIC_RULE_ICONS = new Set([
  'sentry/plugins/components/pluginIcon',
  'sentry.mail.actions.NotifyEmailAction',
  'sentry.rules.actions.notify_event.NotifyEventAction',
  'sentry.rules.actions.notify_event_service.NotifyEventServiceAction',
  'sentry.rules.actions.sentry_apps.notify_event.NotifyEventSentryAppAction',
  'sentry.integrations.slack.notify_action.SlackNotifyServiceAction',
  'sentry.integrations.discord.notify_action.DiscordNotifyServiceAction',
  'sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction',
  'sentry.integrations.jira.notify_action.JiraCreateTicketAction',
  'sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction',
  'sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction',
  'sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction',
]);

const RULE_ICON_MAP = {
  'sentry.mail.actions.NotifyEmailAction': <IconMail />,
  'sentry.rules.actions.notify_event.NotifyEventAction': <IconSentry />,
  'sentry.rules.actions.notify_event_service.NotifyEventServiceAction': <IconGeneric />,
  'sentry.rules.actions.sentry_apps.notify_event.NotifyEventSentryAppAction': (
    <IconSentry />
  ),
  'sentry.integrations.slack.notify_action.SlackNotifyServiceAction': (
    <PluginIcon pluginId="slack" size={20} />
  ),
  'sentry.integrations.discord.notify_action.DiscordNotifyServiceAction': (
    <PluginIcon pluginId="discord" size={20} />
  ),
  'sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction': (
    <PluginIcon pluginId="vsts" size={20} />
  ),
  'sentry.integrations.jira.notify_action.JiraCreateTicketAction': (
    <PluginIcon pluginId="jira" size={20} />
  ),
  'sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction': (
    <PluginIcon pluginId="msteams" size={20} />
  ),
  'sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction': (
    <PluginIcon pluginId="opsgenie" size={20} />
  ),
  'sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction': (
    <PluginIcon pluginId="pagerduty" size={20} />
  ),
};

export function getActionIcon(action: IssueAlertRuleAction): React.ReactNode {
  if (STATIC_RULE_ICONS.has(action.id)) {
    return RULE_ICON_MAP[action.id];
  }
  return <IconSad />;
}
