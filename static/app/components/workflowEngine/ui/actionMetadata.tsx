import {IconMail} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {ActionType} from 'sentry/types/workflowEngine/actions';

const ICON_SIZE = 20;

export const ActionMetadata: Partial<
  Record<ActionType, {icon: React.ReactNode; name: string}>
> = {
  [ActionType.AZURE_DEVOPS]: {
    name: t('Azure DevOps'),
    icon: <PluginIcon pluginId="vsts" size={ICON_SIZE} />,
  },
  [ActionType.DISCORD]: {
    name: t('Discord'),
    icon: <PluginIcon pluginId={'discord'} size={ICON_SIZE} />,
  },
  [ActionType.EMAIL]: {name: t('Email'), icon: <IconMail size="md" />},
  [ActionType.GITHUB]: {
    name: t('GitHub'),
    icon: <PluginIcon pluginId="github" size={ICON_SIZE} />,
  },
  [ActionType.GITHUB_ENTERPRISE]: {
    name: t('GitHub Enterprise'),
    icon: <PluginIcon pluginId="github_enterprise" size={ICON_SIZE} />,
  },
  [ActionType.JIRA]: {
    name: t('JIRA'),
    icon: <PluginIcon pluginId="jira" size={ICON_SIZE} />,
  },
  [ActionType.JIRA_SERVER]: {
    name: t('JIRA Server'),
    icon: <PluginIcon pluginId="jira_server" size={ICON_SIZE} />,
  },
  [ActionType.MSTEAMS]: {
    name: t('Teams'),
    icon: <PluginIcon pluginId="msteams" size={ICON_SIZE} />,
  },
  [ActionType.OPSGENIE]: {
    name: t('Ops Genie'),
    icon: <PluginIcon pluginId="opsgenie" size={ICON_SIZE} />,
  },
  [ActionType.PAGERDUTY]: {
    name: t('Pager Duty'),
    icon: <PluginIcon pluginId="pagerduty" size={ICON_SIZE} />,
  },
  [ActionType.PLUGIN]: {
    name: t('Plugin'),
    icon: <PluginIcon pluginId="placeholder" size={ICON_SIZE} />,
  },
  [ActionType.SENTRY_APP]: {
    name: t('Sentry App'),
    icon: <PluginIcon pluginId="sentry" size={ICON_SIZE} />,
  },
  [ActionType.SLACK]: {
    name: t('Slack'),
    icon: <PluginIcon pluginId="slack" size={ICON_SIZE} />,
  },
  [ActionType.WEBHOOK]: {
    name: t('Webhook'),
    icon: <PluginIcon pluginId="webhooks" size={ICON_SIZE} />,
  },
};
