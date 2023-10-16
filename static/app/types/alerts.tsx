import type {SchemaFormConfig} from 'sentry/views/settings/organizationIntegrations/sentryAppExternalForm';

import type {IssueConfigField} from './integrations';

export const enum IssueAlertActionType {
  SLACK = 'sentry.integrations.slack.notify_action.SlackNotifyServiceAction',
  NOTIFY_EMAIL = 'sentry.mail.actions.NotifyEmailAction',
  DISCORD = 'sentry.integrations.discord.notify_action.DiscordNotifyServiceAction',
  JIRA_CREATE_TICKET = 'sentry.integrations.jira.notify_action.JiraCreateTicketAction',
  JIRA_SERVER_CREATE_TICKET = 'sentry.integrations.jira_server.notify_action.JiraServerCreateTicketAction',
  AZURE_DEVOPS_CREATE_TICKET = 'sentry.integrations.vsts.notify_action.AzureDevopsCreateTicketAction',
  SENTRY_APP = 'sentry.rules.actions.notify_event_sentry_app.NotifyEventSentryAppAction',
  MS_TEAMS = 'sentry.integrations.msteams.notify_action.MsTeamsNotifyServiceAction',
  PAGER_DUTY = 'sentry.integrations.pagerduty.notify_action.PagerDutyNotifyServiceAction',
  OPSGENIE = 'sentry.integrations.opsgenie.notify_action.OpsgenieNotifyTeamAction',
}

export const enum IssueAlertConditionType {
  EVERY_EVENT = 'sentry.rules.conditions.every_event.EveryEventCondition',
  FIRST_SEEN_EVENT = 'sentry.rules.conditions.first_seen_event.FirstSeenEventCondition',
  REGRESSION_EVENT = 'sentry.rules.conditions.regression_event.RegressionEventCondition',
  REAPPEARED_EVENT = 'sentry.rules.conditions.reappeared_event.ReappearedEventCondition',
  EVENT_FREQUENCY = 'sentry.rules.conditions.event_frequency.EventFrequencyCondition',
  EVENT_UNIQUE_USER_FREQUENCY = 'sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition',
  EVENT_FREQUENCY_PERCENT = 'sentry.rules.conditions.event_frequency.EventFrequencyPercentCondition',
}

export const enum IssueAlertFilterType {
  AGE_COMPARISON = 'sentry.rules.filters.age_comparison.AgeComparisonFilter',
  ISSUE_OCCURRENCES = 'sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter',
  ASSIGNED_TO = 'sentry.rules.filters.assigned_to.AssignedToFilter',
  LATEST_RELEASE = 'sentry.rules.filters.latest_release.LatestReleaseFilter',
  ISSUE_CATEGORY = 'sentry.rules.filters.issue_category.IssueCategoryFilter',
  EVENT_ATTRIBUTE = 'sentry.rules.filters.event_attribute.EventAttributeFilter',
  TAGGED_EVENT = 'sentry.rules.filters.tagged_event.TaggedEventFilter',
  LEVEL = 'sentry.rules.filters.level.LevelFilter',
}

type IssueAlertRuleFormField =
  | {
      type: 'choice';
      choices?: [string, string][];
      initial?: string;
      placeholder?: string;
    }
  | {
      type: 'string';
      initial?: string;
      placeholder?: string;
    }
  | {
      type: 'number';
      initial?: string;
      placeholder?: number | string;
    };

/**
 * These templates that tell the UI how to render the action or condition
 * and what fields it needs
 */
export interface IssueAlertRuleActionTemplate {
  enabled: boolean;
  id: string;
  label: string;
  actionType?: 'ticket' | 'sentryapp';
  formFields?:
    | {
        [key: string]: IssueAlertRuleFormField;
      }
    | SchemaFormConfig;
  link?: string;
  prompt?: string;
  sentryAppInstallationUuid?: string;
  ticketType?: string;
}
export type IssueAlertRuleConditionTemplate = IssueAlertRuleActionTemplate;

/**
 * These are the action or condition data that the user is editing or has saved.
 */
export interface IssueAlertRuleAction
  extends Omit<IssueAlertRuleActionTemplate, 'formFields' | 'enabled' | 'label'> {
  // These are the same values as the keys in `formFields` for a template
  [key: string]: any;
  dynamic_form_fields?: IssueConfigField[];
}

export type IssueAlertRuleCondition = Omit<
  IssueAlertRuleConditionTemplate,
  'formFields' | 'enabled' | 'label'
> & {
  dynamic_form_fields?: IssueConfigField[];
} & {
  // These are the same values as the keys in `formFields` for a template
  [key: string]: number | string;
};

export interface UnsavedIssueAlertRule {
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
  errors?: {detail: string}[];
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

// Project's alert rule stats
export type ProjectAlertRuleStats = {
  count: number;
  date: string;
};

export enum MailActionTargetType {
  ISSUE_OWNERS = 'IssueOwners',
  TEAM = 'Team',
  MEMBER = 'Member',
  RELEASE_MEMBERS = 'ReleaseMembers',
}

export enum AssigneeTargetType {
  UNASSIGNED = 'Unassigned',
  TEAM = 'Team',
  MEMBER = 'Member',
}

export type NoteType = {
  mentions: string[];
  text: string;
};

/**
 * Used when determining what types of actions a rule has. The default action is "sentry.mail.actions.NotifyEmailAction"
 * while other actions can be integration (Slack, PagerDuty, etc) actions. We need to know this to determine what kind of muting
 * the alert should have.
 */
export enum RuleActionsCategories {
  ALL_DEFAULT = 'all_default',
  SOME_DEFAULT = 'some_default',
  NO_DEFAULT = 'no_default',
}
