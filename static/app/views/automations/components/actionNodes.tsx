import type React from 'react';
import {createContext, useContext} from 'react';

import {t} from 'sentry/locale';
import type {Action, ActionHandler} from 'sentry/types/workflowEngine/actions';
import {ActionType} from 'sentry/types/workflowEngine/actions';
import {
  AzureDevOpsDetails,
  AzureDevOpsNode,
} from 'sentry/views/automations/components/actions/azureDevOps';
import {
  DiscordDetails,
  DiscordNode,
} from 'sentry/views/automations/components/actions/discord';
import {EmailDetails, EmailNode} from 'sentry/views/automations/components/actions/email';
import {
  GithubDetails,
  GithubNode,
} from 'sentry/views/automations/components/actions/github';
import {
  GithubEnterpriseDetails,
  GithubEnterpriseNode,
} from 'sentry/views/automations/components/actions/githubEnterprise';
import {JiraDetails, JiraNode} from 'sentry/views/automations/components/actions/jira';
import {
  JiraServerDetails,
  JiraServerNode,
} from 'sentry/views/automations/components/actions/jiraServer';
import {
  MSTeamsDetails,
  MSTeamsNode,
} from 'sentry/views/automations/components/actions/msTeams';
import {
  OpsgenieDetails,
  OpsgenieNode,
} from 'sentry/views/automations/components/actions/opsgenie';
import {
  PagerdutyDetails,
  PagerdutyNode,
} from 'sentry/views/automations/components/actions/pagerduty';
import {PluginNode} from 'sentry/views/automations/components/actions/plugin';
import {
  SentryAppDetails,
  SentryAppNode,
} from 'sentry/views/automations/components/actions/sentryApp';
import {SlackDetails, SlackNode} from 'sentry/views/automations/components/actions/slack';
import {
  WebhookDetails,
  WebhookNode,
} from 'sentry/views/automations/components/actions/webhook';

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
  link?: string;
  ticketType?: string;
};

export const actionNodesMap = new Map<ActionType, ActionNode>([
  [
    ActionType.AZURE_DEVOPS,
    {
      label: t('Azure DevOps'),
      action: AzureDevOpsNode,
      details: AzureDevOpsDetails,
      ticketType: t('an Azure DevOps work item'),
      link: 'https://docs.sentry.io/product/integrations/source-code-mgmt/azure-devops/#issue-sync',
    },
  ],
  [
    ActionType.EMAIL,
    {label: t('Notify on preferred channel'), action: EmailNode, details: EmailDetails},
  ],
  [
    ActionType.DISCORD,
    {
      label: t('Discord'),
      action: DiscordNode,
      details: DiscordDetails,
    },
  ],
  [
    ActionType.GITHUB,
    {
      label: t('Github'),
      action: GithubNode,
      details: GithubDetails,
      ticketType: t('a GitHub issue'),
    },
  ],
  [
    ActionType.GITHUB_ENTERPRISE,
    {
      label: t('Github Enterprise'),
      action: GithubEnterpriseNode,
      details: GithubEnterpriseDetails,
      ticketType: t('a GitHub Enterprise issue'),
    },
  ],
  [
    ActionType.JIRA,
    {
      label: t('Jira'),
      action: JiraNode,
      details: JiraDetails,
      ticketType: t('a Jira issue'),
      link: 'https://docs.sentry.io/product/integrations/issue-tracking/jira/#issue-sync',
    },
  ],
  [
    ActionType.JIRA_SERVER,
    {
      label: t('Jira Server'),
      action: JiraServerNode,
      details: JiraServerDetails,
      ticketType: t('a Jira Server issue'),
      link: 'https://docs.sentry.io/product/integrations/issue-tracking/jira/#issue-sync',
    },
  ],
  [
    ActionType.MSTEAMS,
    {
      label: t('MS Teams'),
      action: MSTeamsNode,
      details: MSTeamsDetails,
    },
  ],
  [
    ActionType.OPSGENIE,
    {label: t('Opsgenie'), action: OpsgenieNode, details: OpsgenieDetails},
  ],
  [
    ActionType.PAGERDUTY,
    {
      label: t('Pagerduty'),
      action: PagerdutyNode,
      details: PagerdutyDetails,
    },
  ],
  [
    ActionType.PLUGIN,
    {
      label: t('Legacy integrations'),
      action: PluginNode,
      details: PluginNode,
    },
  ],
  [
    ActionType.SENTRY_APP,
    {
      action: SentryAppNode,
      details: SentryAppDetails,
    },
  ],
  [
    ActionType.SLACK,
    {
      label: t('Slack'),
      action: SlackNode,
      details: SlackDetails,
    },
  ],
  [
    ActionType.WEBHOOK,
    {
      label: t('Send a notification via an integration'),
      action: WebhookNode,
      details: WebhookDetails,
    },
  ],
]);
