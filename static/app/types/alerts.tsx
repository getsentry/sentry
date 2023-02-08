import type {SchemaFormConfig} from 'sentry/views/settings/organizationIntegrations/sentryAppExternalForm';

import type {IssueConfigField} from './integrations';

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
  name: string;
  prompt: string;
  actionType?: 'ticket' | 'sentryapp';
  formFields?:
    | {
        [key: string]: IssueAlertRuleFormField;
      }
    | SchemaFormConfig;
  link?: string;
  sentryAppInstallationUuid?: string;
  ticketType?: string;
}
export type IssueAlertRuleConditionTemplate = IssueAlertRuleActionTemplate;

/**
 * These are the action or condition data that the user is editing or has saved.
 */
export interface IssueAlertRuleAction
  extends Omit<IssueAlertRuleActionTemplate, 'formFields' | 'enabled'> {
  // These are the same values as the keys in `formFields` for a template
  [key: string]: any;
  dynamic_form_fields?: IssueConfigField[];
}

export type IssueAlertRuleCondition = Omit<
  IssueAlertRuleConditionTemplate,
  'formFields' | 'enabled'
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
  errors?: {detail: string}[];
  lastTriggered?: string;
}

// Project's alert rule stats
export type ProjectAlertRuleStats = {
  count: number;
  date: string;
};

export enum MailActionTargetType {
  IssueOwners = 'IssueOwners',
  Team = 'Team',
  Member = 'Member',
  ReleaseMembers = 'ReleaseMembers',
}

export enum AssigneeTargetType {
  Unassigned = 'Unassigned',
  Team = 'Team',
  Member = 'Member',
}

export type NoteType = {
  mentions: string[];
  text: string;
};
