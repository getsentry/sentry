/**
 * These templates that tell the UI how to render the action or condition
 * and what fields it needs
 */
export type IssueAlertRuleActionTemplate = {
  id: string;
  label: string;
  enabled: boolean;
  formFields?: {
    [key: string]:
      | {
          type: 'choice';
          choices: [string, string][];
          placeholder?: string;
        }
      | {
          type: 'string';
          placeholder?: string;
        }
      | {
          type: 'number';
          placeholder?: number | string;
        };
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

// Issue-based alert rule
export type IssueAlertRule = {
  actionMatch: 'all' | 'any';
  actions: IssueAlertRuleAction[];
  conditions: IssueAlertRuleCondition[];
  dateCreated: string;
  environment: null | string;
  frequency: number;
  id: string;
  name: string;
};
