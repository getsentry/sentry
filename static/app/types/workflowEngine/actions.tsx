export interface Action {
  data: Record<string, unknown>;
  id: string;
  type: ActionType;
}

enum ActionType {
  SLACK = 'slack',
  MSTEAMS = 'msteams',
  DISCORD = 'discord',
  PAGERDUTY = 'pagerduty',
  OPSGENIE = 'opsgenie',
  GITHUB = 'github',
  GITHUB_ENTERPRISE = 'github_enterprise',
  JIRA = 'jira',
  JIRA_SERVER = 'jira_server',
  AZURE_DEVOPS = 'azure_devops',
  EMAIL = 'email',
  SENTRY_APP = 'sentry_app',
  PLUGIN = 'plugin',
  WEBHOOK = 'webhook',
}
