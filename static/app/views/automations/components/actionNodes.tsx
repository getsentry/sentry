import {createContext, useContext} from 'react';

import {t} from 'sentry/locale';
import type {Action, Integration} from 'sentry/types/workflowEngine/actions';
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
import {SlackNode} from 'sentry/views/automations/components/actions/slack';

interface ActionNodeProps {
  action: Action;
  actionId: string;
  onUpdate: (condition: Record<string, any>) => void;
  integrations?: Integration[];
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
  action: React.ReactNode;
  label: string;
};

export const actionNodesMap = new Map<ActionType, ActionNode>([
  [ActionType.AZURE_DEVOPS, {label: t('Azure DevOps'), action: <AzureDevOpsNode />}],
  [ActionType.EMAIL, {label: t('Email'), action: <EmailNode />}],
  [
    ActionType.DISCORD,
    {
      label: t('Discord'),
      action: <DiscordNode />,
    },
  ],
  [ActionType.GITHUB, {label: t('Github'), action: <GithubNode />}],
  [
    ActionType.GITHUB_ENTERPRISE,
    {label: t('Github Enterprise'), action: <GithubEnterpriseNode />},
  ],
  [ActionType.JIRA, {label: t('Jira'), action: <JiraNode />}],
  [ActionType.JIRA_SERVER, {label: t('Jira Server'), action: <JiraServerNode />}],
  [
    ActionType.MSTEAMS,
    {
      label: t('MS Teams'),
      action: <MSTeamsNode />,
    },
  ],
  [ActionType.OPSGENIE, {label: t('Opsgenie'), action: <OpsgenieNode />}],
  [
    ActionType.PAGERDUTY,
    {
      label: t('Pagerduty'),
      action: <PagerdutyNode />,
    },
  ],
  [
    ActionType.SLACK,
    {
      label: t('Slack'),
      action: <SlackNode />,
    },
  ],
]);
