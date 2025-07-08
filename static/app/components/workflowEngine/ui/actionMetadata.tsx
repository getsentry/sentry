import styled from '@emotion/styled';

import {IconMail} from 'sentry/icons';
import {t} from 'sentry/locale';
import {PluginIcon} from 'sentry/plugins/components/pluginIcon';
import {ActionType} from 'sentry/types/workflowEngine/actions';

const ICON_SIZE = 20;

const StyledPluginIcon = styled(PluginIcon)`
  display: inline-block;
  vertical-align: middle;
`;

export const ActionMetadata: Partial<
  Record<ActionType, {icon: React.ReactNode; name: string}>
> = {
  [ActionType.AZURE_DEVOPS]: {
    name: t('Azure DevOps'),
    icon: <StyledPluginIcon pluginId="vsts" size={ICON_SIZE} />,
  },
  [ActionType.DISCORD]: {
    name: t('Discord'),
    icon: <StyledPluginIcon pluginId={'discord'} size={ICON_SIZE} />,
  },
  [ActionType.EMAIL]: {name: t('Email'), icon: <IconMail size="md" />},
  [ActionType.GITHUB]: {
    name: t('GitHub'),
    icon: <StyledPluginIcon pluginId="github" size={ICON_SIZE} />,
  },
  [ActionType.GITHUB_ENTERPRISE]: {
    name: t('GitHub Enterprise'),
    icon: <StyledPluginIcon pluginId="github_enterprise" size={ICON_SIZE} />,
  },
  [ActionType.JIRA]: {
    name: t('JIRA'),
    icon: <StyledPluginIcon pluginId="jira" size={ICON_SIZE} />,
  },
  [ActionType.JIRA_SERVER]: {
    name: t('JIRA Server'),
    icon: <StyledPluginIcon pluginId="jira_server" size={ICON_SIZE} />,
  },
  [ActionType.MSTEAMS]: {
    name: t('Teams'),
    icon: <StyledPluginIcon pluginId="msteams" size={ICON_SIZE} />,
  },
  [ActionType.OPSGENIE]: {
    name: t('Opsgenie'),
    icon: <StyledPluginIcon pluginId="opsgenie" size={ICON_SIZE} />,
  },
  [ActionType.PAGERDUTY]: {
    name: t('Pagerduty'),
    icon: <StyledPluginIcon pluginId="pagerduty" size={ICON_SIZE} />,
  },
  [ActionType.PLUGIN]: {
    name: t('Plugin'),
    icon: <StyledPluginIcon pluginId="placeholder" size={ICON_SIZE} />,
  },
  [ActionType.SENTRY_APP]: {
    name: t('Sentry App'),
    icon: <StyledPluginIcon pluginId="sentry" size={ICON_SIZE} />,
  },
  [ActionType.SLACK]: {
    name: t('Slack'),
    icon: <StyledPluginIcon pluginId="slack" size={ICON_SIZE} />,
  },
  [ActionType.WEBHOOK]: {
    name: t('Webhook'),
    icon: <StyledPluginIcon pluginId="webhooks" size={ICON_SIZE} />,
  },
};
