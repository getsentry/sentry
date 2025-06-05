import type React from 'react';
import {createContext, useContext} from 'react';

import {t} from 'sentry/locale';
import type {Action, ActionHandler} from 'sentry/types/workflowEngine/actions';
import {ActionType} from 'sentry/types/workflowEngine/actions';
import {AzureDevOpsNode} from 'sentry/views/automations/components/actions/azureDevOps';
import {DiscordNode} from 'sentry/views/automations/components/actions/discord';
import {EmailNode} from 'sentry/views/automations/components/actions/email';
import {GithubNode} from 'sentry/views/automations/components/actions/github';
import {GithubEnterpriseNode} from 'sentry/views/automations/components/actions/githubEnterprise';
import {JiraNode} from 'sentry/views/automations/components/actions/jira';
import {JiraServerNode} from 'sentry/views/automations/components/actions/jiraServer';
import {MSTeamsNode} from 'sentry/views/automations/components/actions/msTeams';
import {OpsgenieNode} from 'sentry/views/automations/components/actions/opsgenie';
import {PagerdutyNode} from 'sentry/views/automations/components/actions/pagerduty';
import {PluginNode} from 'sentry/views/automations/components/actions/plugin';
import {SentryAppNode} from 'sentry/views/automations/components/actions/sentryApp';
import {SlackNode} from 'sentry/views/automations/components/actions/slack';
import {WebhookNode} from 'sentry/views/automations/components/actions/webhook';

interface ActionNodeProps {
  action: Action;
  actionId: string;
  handler: ActionHandler;
  onUpdate: (params: Record<string, any>) => void;
}

export const ActionNodeContext = createContext<ActionNodeProps | null>(null);

export function useActionNodeContext(): ActionNodeProps {
  const context = useContext(ActionNodeContext);
  if (!context) {
    throw new Error('useActionNodeContext was called outside of ActionNode');
  }
  return context;
}

type ActionNode = {
  action: React.ComponentType<any>;
  details?: React.ComponentType<any>;
  label?: string;
};

export const actionNodesMap = new Map<ActionType, ActionNode>([
  [ActionType.AZURE_DEVOPS, {label: t('Azure DevOps'), action: AzureDevOpsNode}],
  [ActionType.EMAIL, {label: t('Notify on preferred channel'), action: EmailNode}],
  [
    ActionType.DISCORD,
    {
      label: t('Discord'),
      action: DiscordNode,
    },
  ],
  [ActionType.GITHUB, {label: t('Github'), action: GithubNode}],
  [
    ActionType.GITHUB_ENTERPRISE,
    {label: t('Github Enterprise'), action: GithubEnterpriseNode},
  ],
  [ActionType.JIRA, {label: t('Jira'), action: JiraNode}],
  [ActionType.JIRA_SERVER, {label: t('Jira Server'), action: JiraServerNode}],
  [
    ActionType.MSTEAMS,
    {
      label: t('MS Teams'),
      action: MSTeamsNode,
    },
  ],
  [ActionType.OPSGENIE, {label: t('Opsgenie'), action: OpsgenieNode}],
  [
    ActionType.PAGERDUTY,
    {
      label: t('Pagerduty'),
      action: PagerdutyNode,
    },
  ],
  [
    ActionType.PLUGIN,
    {
      label: t('Legacy integrations'),
      action: PluginNode,
    },
  ],
  [
    ActionType.SENTRY_APP,
    {
      action: SentryAppNode,
    },
  ],
  [
    ActionType.SLACK,
    {
      label: t('Slack'),
      action: SlackNode,
    },
  ],
  [
    ActionType.WEBHOOK,
    {label: t('Send a notification via an integration'), action: WebhookNode},
  ],
]);
