import type React from 'react';

import {t} from 'sentry/locale';
import type {Action} from 'sentry/types/workflowEngine/actions';
import {ActionType} from 'sentry/types/workflowEngine/actions';

import {AzureDevOpsDetails, AzureDevOpsNode} from './actions/azureDevOps';
import {DiscordDetails, DiscordNode, validateDiscordAction} from './actions/discord';
import {EmailDetails, EmailNode, validateEmailAction} from './actions/email';
import {GithubDetails, GithubNode} from './actions/github';
import {GithubEnterpriseDetails, GithubEnterpriseNode} from './actions/githubEnterprise';
import {JiraDetails, JiraNode} from './actions/jira';
import {JiraServerDetails, JiraServerNode} from './actions/jiraServer';
import {MSTeamsDetails, MSTeamsNode, validateMSTeamsAction} from './actions/msTeams';
import {OpsgenieDetails, OpsgenieNode, validateOpsgenieAction} from './actions/opsgenie';
import {
  PagerdutyDetails,
  PagerdutyNode,
  validatePagerdutyAction,
} from './actions/pagerduty';
import {PluginNode} from './actions/plugin';
import {SentryAppDetails, SentryAppNode} from './actions/sentryApp';
import {SlackDetails, SlackNode, validateSlackAction} from './actions/slack';
import {validateWebhookAction, WebhookDetails, WebhookNode} from './actions/webhook';

type ActionNode = {
  action: React.ComponentType<any>;
  validate: ((action: Action) => string | undefined) | undefined;
  defaultData?: Record<string, any>;
  details?: React.ComponentType<any>;
  label?: string;
};

export const actionNodesMap = new Map<ActionType, ActionNode>([
  [
    ActionType.AZURE_DEVOPS,
    {
      label: t('Azure DevOps'),
      action: AzureDevOpsNode,
      details: AzureDevOpsDetails,
      validate: validateIntegrationId,
    },
  ],
  [
    ActionType.EMAIL,
    {
      label: t('Notify on preferred channel'),
      action: EmailNode,
      details: EmailDetails,
      defaultData: {fallthroughType: 'ActiveMembers'},
      validate: validateEmailAction,
    },
  ],
  [
    ActionType.DISCORD,
    {
      label: t('Discord'),
      action: DiscordNode,
      details: DiscordDetails,
      validate: validateDiscordAction,
    },
  ],
  [
    ActionType.GITHUB,
    {
      label: t('GitHub'),
      action: GithubNode,
      details: GithubDetails,
      validate: validateIntegrationId,
    },
  ],
  [
    ActionType.GITHUB_ENTERPRISE,
    {
      label: t('GitHub Enterprise'),
      action: GithubEnterpriseNode,
      details: GithubEnterpriseDetails,
      validate: validateIntegrationId,
    },
  ],
  [
    ActionType.JIRA,
    {
      label: t('Jira'),
      action: JiraNode,
      details: JiraDetails,
      validate: validateIntegrationId,
    },
  ],
  [
    ActionType.JIRA_SERVER,
    {
      label: t('Jira Server'),
      action: JiraServerNode,
      details: JiraServerDetails,
      validate: validateIntegrationId,
    },
  ],
  [
    ActionType.MSTEAMS,
    {
      label: t('MS Teams'),
      action: MSTeamsNode,
      details: MSTeamsDetails,
      validate: validateMSTeamsAction,
    },
  ],
  [
    ActionType.OPSGENIE,
    {
      label: t('Opsgenie'),
      action: OpsgenieNode,
      details: OpsgenieDetails,
      defaultData: {priority: 'P1'},
      validate: validateOpsgenieAction,
    },
  ],
  [
    ActionType.PAGERDUTY,
    {
      label: t('Pagerduty'),
      action: PagerdutyNode,
      details: PagerdutyDetails,
      defaultData: {priority: 'default'},
      validate: validatePagerdutyAction,
    },
  ],
  [
    ActionType.PLUGIN,
    {
      label: t('Legacy integrations'),
      action: PluginNode,
      details: PluginNode,
      validate: undefined,
    },
  ],
  [
    ActionType.SENTRY_APP,
    {
      action: SentryAppNode,
      details: SentryAppDetails,
      validate: undefined,
    },
  ],
  [
    ActionType.SLACK,
    {
      label: t('Slack'),
      action: SlackNode,
      details: SlackDetails,
      validate: validateSlackAction,
    },
  ],
  [
    ActionType.SLACK_STAGING,
    {
      label: t('Slack (Staging)'),
      action: SlackNode,
      details: SlackDetails,
      validate: validateSlackAction,
    },
  ],
  [
    ActionType.WEBHOOK,
    {
      label: t('Send a notification via an integration'),
      action: WebhookNode,
      details: WebhookDetails,
      validate: validateWebhookAction,
    },
  ],
]);

function validateIntegrationId(action: Action): string | undefined {
  if (!action.integrationId) {
    return t('You must specify an integration installation.');
  }
  return undefined;
}
