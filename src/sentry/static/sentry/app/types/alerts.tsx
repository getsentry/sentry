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

export type UnsavedIssueAlertRule = {
  actionMatch: 'all' | 'any';
  actions: IssueAlertRuleAction[];
  conditions: IssueAlertRuleCondition[];
  environment: null | string;
  frequency: number;
  name: string;
};
// Issue-based alert rule
export type IssueAlertRule = UnsavedIssueAlertRule & {
  dateCreated: string;
  id: string;
};

/**
 * This is an Action that is associated to a Trigger in a Metric Alert Rule
 */
export type MetricAction = {
  /**
   * The integration type e.g. 'email'
   */
  type: string;

  /**
   * e.g.
   * - `user` - user id,
   * - `team` - team id
   * - `specific` - free text
   */
  allowedTargetTypes: Array<'user' | 'team' | 'specific'>;

  /**
   * Name of the integration. This is a text field that differentiates integrations from the same provider from each other
   */
  integrationName: string;

  /**
   * Integration id for this `type`, should be passed to backend as `integrationId` when creating an action
   */
  integrationId: number;
};
