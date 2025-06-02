export interface Action {
  config: {
    target_type: ActionTarget;
    target_display?: string;
    target_identifier?: string;
  };
  data: Record<string, unknown>;
  id: string;
  type: ActionType;
  integrationId?: string;
}

export enum ActionTarget {
  SPECIFIC = 0,
  USER = 1,
  TEAM = 2,
  SENTRY_APP = 3,
  ISSUE_OWNERS = 4,
}

export enum ActionType {
  SLACK = 'slack',
  MSTEAMS = 'msteams',
  DISCORD = 'discord',
  PAGERDUTY = 'pagerduty',
  OPSGENIE = 'opsgenie',
  GITHUB = 'github',
  GITHUB_ENTERPRISE = 'github_enterprise',
  JIRA = 'jira',
  JIRA_SERVER = 'jira_server',
  AZURE_DEVOPS = 'vsts',
  EMAIL = 'email',
  SENTRY_APP = 'sentry_app',
  PLUGIN = 'plugin',
  WEBHOOK = 'webhook',
}

export enum ActionGroup {
  NOTIFICATION = 'notification',
  TICKET_CREATION = 'ticket_creation',
  OTHER = 'other',
}

export interface ActionHandler {
  configSchema: Record<string, any>;
  dataSchema: Record<string, any>;
  handlerGroup: ActionGroup;
  type: ActionType;
  integrations?: Integration[];
  sentryApp?: SentryAppContext;
  services?: PluginService[];
}
interface Integration {
  id: string;
  name: string;
  services?: Array<{
    id: string;
    name: string;
  }>;
}

interface SentryAppContext {
  id: string;
  installationId: string;
  name: string;
  status: number;
  settings?: Record<string, any>;
  title?: string;
}

interface PluginService {
  name: string;
  slug: string;
}
