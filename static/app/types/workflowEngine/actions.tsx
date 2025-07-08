import type {IssueConfigField} from 'sentry/types/integrations';

export interface Action {
  config: ActionConfig;
  data: Record<string, any>;
  id: string;
  type: ActionType;
  integrationId?: string;
}

export interface TicketCreationAction extends Action {
  [key: string]: any;
  data: {
    additional_fields?: Record<string, any>;
    dynamic_form_fields?: IssueConfigField[];
  };
  integrationId: string;
}

export interface ActionConfig {
  target_type: ActionTarget | null;
  sentry_app_identifier?: SentryAppIdentifier;
  target_display?: string;
  target_identifier?: string;
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

export enum SentryAppIdentifier {
  SENTRY_APP_INSTALLATION_UUID = 'sentry_app_installation_uuid',
  SENTRY_APP_ID = 'sentry_app_id',
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
  installationUuid: string;
  name: string;
  status: number;
  settings?: Record<string, any>;
  // title represents the action being performed by the SentryApp
  // e.g. "Create an issue"
  title?: string;
}

interface PluginService {
  name: string;
  slug: string;
}
