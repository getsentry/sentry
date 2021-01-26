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
  OR = 'or',
  AND = 'and',
  NOT = 'not',
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

type DynamicSamplingConditionLogicalInner = {
  operator:
    | DynamicSamplingConditionOperator.STR_EQUAL_NO_CASE
    | DynamicSamplingConditionOperator.GLOB_MATCH
    | DynamicSamplingConditionOperator.EQUAL;
  name: string;
  value: Array<string>;
};

export type DynamicSamplingConditionLogicalNot = {
  operator: DynamicSamplingConditionOperator.NOT;
  inner: DynamicSamplingConditionLogicalInner;
};

export type DynamicSamplingConditionLogicalOthers = {
  operator: DynamicSamplingConditionOperator.AND | DynamicSamplingConditionOperator.OR;
  inner: Array<DynamicSamplingConditionLogicalInner>;
};

export type DynamicSamplingConditionOthers = DynamicSamplingConditionLogicalInner;

export type DynamicSamplingCondition =
  | DynamicSamplingConditionLogicalNot
  | DynamicSamplingConditionLogicalOthers
  | DynamicSamplingConditionOthers;

export type DynamicSamplingRule = {
  /**
   * It is a possibly empty list of conditions to which the rule applies.
   * The conditions are combined using the and operator (so all the conditions must be satisfied for the rule to apply).
   * If the conditions field is an empty list the rule applies for all events that satisfy the projectIds and the ty fields.
   */
  condition: DynamicSamplingCondition;
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
