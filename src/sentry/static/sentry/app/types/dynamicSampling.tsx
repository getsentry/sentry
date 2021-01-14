export enum DynamicSamplingRuleType {
  /**
   * The rule applies to traces (transaction events considered in the context of a trace)
   */
  TRACE = 'trace',
  /**
   *  The rule applies to transaction events considered independently
   */
  TRANSACTION = 'transaction',
  /**
   * The rule applies to error events (not transaction events)
   */
  ERROR = 'error',
}

export enum DynamicSamplingConditionOperator {
  /**
   * It uses glob matches for checking (e.g. releases use glob matching "1.1.*" will match release 1.1.1 and 1.1.2)
   */
  GLOB_MATCH = 'globMatch',
  /**
   * It uses simple equality for checking
   */
  EQUAL = 'equal',
  /**
   * It uses a case insensitive string comparison
   */
  STR_EQUAL_NO_CASE = 'strEqualNoCase',
}

export type DynamicSamplingCondition = {
  /**
   * The function that will be applied to check if the condition is satisfied.
   * Currently there are three operators defined.
   */
  operator: DynamicSamplingConditionOperator;
  /**
   * The name of the filed to be used for comparison
   */
  name: string;
  /**
   * Values to be compared (using the operator) against the field (specified by the field name)
   */
  value: Array<string> | string | number | boolean;
};

export type DynamicSamplingRule = {
  /**
   * It is a possibly empty list of project ids to which the rule applies.
   * If the list is empty the rules applies for all projects in the organization
   */
  projectIds: Array<number>;
  /**
   * It is a possibly empty list of conditions to which the rule applies.
   * The conditions are combined using the and operator (so all the conditions must be satisfied for the rule to apply).
   * If the conditions field is an empty list the rule applies for all events that satisfy the projectIds and the ty fields.
   */
  conditions: Array<DynamicSamplingCondition>;
  /**
   * It is the sampling rate that will be applied if the rule is selected
   */
  sampleRate: number;
  /**
   * Describes the type of rule
   */
  ty: DynamicSamplingRuleType;
};

export type DynamicSamplingRules = Array<DynamicSamplingRule>;
