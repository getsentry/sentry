export type IssueAlertRuleFormField =
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
      placeholder?: number | string;
      initial?: string;
    };

/**
 * These templates that tell the UI how to render the action or condition
 * and what fields it needs
 */
export type IssueAlertRuleActionTemplate = {
  id: string;
  label: string;
  prompt: string;
  enabled: boolean;
  formFields?: {
    [key: string]: IssueAlertRuleFormField;
  };
};
export type IssueAlertRuleConditionTemplate = IssueAlertRuleActionTemplate;

/**
 * These are the action or condition data that the user is editing or has saved.
 */
export type IssueAlertRuleAction = Omit<
  IssueAlertRuleActionTemplate,
  'formFields' | 'enabled'
> & {
  // These are the same values as the keys in `formFields` for a template
  [key: string]: number | string;
};

export type IssueAlertRuleCondition = Omit<
  IssueAlertRuleConditionTemplate,
  'formFields' | 'enabled'
> & {
  // These are the same values as the keys in `formFields` for a template
  [key: string]: number | string;
};

export type UnsavedIssueAlertRule = {
  /** When an issue matches [actionMatch] of the following */
  actionMatch: 'all' | 'any' | 'none';
  /** If that issue has [filterMatch] of these properties */
  filterMatch: 'all' | 'any' | 'none';
  actions: IssueAlertRuleAction[];
  conditions: IssueAlertRuleCondition[];
  filters: IssueAlertRuleCondition[];
  environment?: null | string;
  frequency: number;
  name: string;
};

// Issue-based alert rule
export type IssueAlertRule = UnsavedIssueAlertRule & {
  dateCreated: string;
  createdBy: {id: number; email: string; name: string} | null;
  projects: string[];
  id: string;
};

export enum MailActionTargetType {
  IssueOwners = 'IssueOwners',
  Team = 'Team',
  Member = 'Member',
}

export enum AssigneeTargetType {
  Unassigned = 'Unassigned',
  Team = 'Team',
  Member = 'Member',
}
