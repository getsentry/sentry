import type {JsonFormAdapterFieldConfig} from 'sentry/components/backendJsonFormAdapter/types';

export const enum IssueAlertActionType {
  SLACK = 'sentry.integrations.slack.notify_action.SlackNotifyServiceAction',
  NOTIFY_EMAIL = 'sentry.mail.actions.NotifyEmailAction',
  DISCORD = 'sentry.integrations.discord.notify_action.DiscordNotifyServiceAction',
  SENTRY_APP = 'sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction',
  MS_TEAMS = 'sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction',
  PAGER_DUTY = 'sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction',
  OPSGENIE = 'sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction',

  /**
   * Legacy integrations
   */
  NOTIFY_EVENT_ACTION = 'sentry.rules.actions.notify_event.NotifyEventAction',

  /**
   * Webhooks
   */
  NOTIFY_EVENT_SERVICE_ACTION = 'sentry.rules.actions.notify_event_service.NotifyEventServiceAction',

  /**
   * Ticket integrations
   */
  JIRA_CREATE_TICKET = 'sentry.integrations.jira.notify_action.JiraCreateTicketAction',
  JIRA_SERVER_CREATE_TICKET = 'sentry.integrations.jira_server.notify_action.JiraServerCreateTicketAction',
  GITHUB_CREATE_TICKET = 'sentry.integrations.github.notify_action.GitHubCreateTicketAction',
  GITHUB_ENTERPRISE_CREATE_TICKET = 'sentry.integrations.github_enterprise.notify_action.GitHubEnterpriseCreateTicketAction',
  AZURE_DEVOPS_CREATE_TICKET = 'sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction',
}

export const enum IssueAlertConditionType {
  EVERY_EVENT = 'sentry.rules.conditions.every_event.EveryEventCondition',
  FIRST_SEEN_EVENT = 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
  REGRESSION_EVENT = 'sentry.rules.conditions.regression_event.RegressionEventCondition',
  REAPPEARED_EVENT = 'sentry.rules.conditions.reappeared_event.ReappearedEventCondition',
  EVENT_FREQUENCY = 'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
  EVENT_UNIQUE_USER_FREQUENCY = 'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition',
  EVENT_UNIQUE_USER_FREQUENCY_WITH_CONDITIONS = 'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyConditionWithConditions',
  EVENT_FREQUENCY_PERCENT = 'sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition',
  NEW_HIGH_PRIORITY_ISSUE = 'sentry.rules.conditions.high_priority_issue.NewHighPriorityIssueCondition',
  EXISTING_HIGH_PRIORITY_ISSUE = 'sentry.rules.conditions.high_priority_issue.ExistingHighPriorityIssueCondition',
}

/**
 * These templates that tell the UI how to render the action or condition
 * and what fields it needs
 */
interface IssueAlertRuleActionTemplate {
  id: string;
  actionType?: 'ticket' | 'sentryapp';
  link?: string;
  prompt?: string;
  sentryAppInstallationUuid?: string;
  ticketType?: string;
}

/**
 * These are the action or condition data that the user is editing or has saved.
 */
export interface IssueAlertRuleAction extends IssueAlertRuleActionTemplate {
  // These are the same values as the keys in `formFields` for a template
  [key: string]: any;
  dynamic_form_fields?: JsonFormAdapterFieldConfig[];
}

type IssueAlertRuleCondition = IssueAlertRuleActionTemplate & {
  dynamic_form_fields?: JsonFormAdapterFieldConfig[];
} & Record<string, number | string>;

export interface TicketActionData {
  [key: string]: any;
  integration: string;
  dynamic_form_fields?: JsonFormAdapterFieldConfig[];
}

interface SlackAction {
  channel: string | undefined;
  id: IssueAlertActionType.SLACK;
  workspace: string | undefined;
  channel_id?: string | undefined;
  notes?: string | undefined;
  tags?: string | undefined;
}
interface DiscordAction {
  channel_id: string | undefined;
  id: IssueAlertActionType.DISCORD;
  server: string | undefined;
  tags?: string | undefined;
}
interface MSTeamsAction {
  channel: string | undefined;
  id: IssueAlertActionType.MS_TEAMS;
  team: string | undefined;
}

export type IntegrationAction = SlackAction | DiscordAction | MSTeamsAction;

interface UnsavedIssueAlertRule {
  /** When an issue matches [actionMatch] of the following */
  actionMatch: 'all' | 'any' | 'none';
  actions: IssueAlertRuleAction[];
  conditions: IssueAlertRuleCondition[];
  /** If that issue has [filterMatch] of these properties */
  filterMatch: 'all' | 'any' | 'none';
  filters: IssueAlertRuleCondition[];
  frequency: number;
  name: string;
  environment?: null | string;
  owner?: string | null;
}

// Issue-based alert rule
export interface IssueAlertRule extends UnsavedIssueAlertRule {
  createdBy: {email: string; id: number; name: string} | null;
  dateCreated: string;
  id: string;
  projects: string[];
  snooze: boolean;
  status: 'active' | 'disabled';
  /**
   * Date alert is set to be disabled unless action is taken
   */
  disableDate?: string;
  disableReason?: 'noisy';
  errors?: Array<{detail: string}>;
  lastTriggered?: string;
  /**
   * Set to true to opt out of the rule being automatically disabled
   * see also - status=disabled, disableDate, disableReason
   * TODO(scttcper): This is only used in the edit request and we should
   *  move it to its own interface
   */
  optOutEdit?: boolean;
  snoozeCreatedBy?: string;
  snoozeForEveryone?: boolean;
}

export type NoteType = {
  mentions: string[];
  text: string;
};
