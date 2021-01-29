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
   * The not combinator has a similar structure with the only difference that "inner" is not an array
   * and contains directly the negated condition
   */
  NOT = 'not',
  /**
   * Combine multiple sub-conditions with the operator 'or'
   */
  OR = 'or',
  /**
   * Combine multiple sub-conditions with the operator 'and'
   */
  AND = 'and',
}

export enum DynamicSamplingInnerOperator {
  /**
   * It uses glob matches for checking (e.g. releases use glob matching "1.1.*" will match release 1.1.1 and 1.1.2)
   */
  GLOB_MATCH = 'glob',
  /**
   * It uses simple equality for checking
   */
  EQUAL = 'eq',
}

export enum DynamicSamplingInnerName {
  TRACE_RELEASE = 'trace.release',
  TRACE_ENVIRONMENT = 'trace.environment',
  TRACE_USER_SEGMENT = 'trace.user_segment',
  EVENT_RELEASE = 'event.release',
  EVENT_ENVIRONMENT = 'event.environment',
  EVENT_USER_SEGMENT = 'event.user_segment',
  LEGACY_BROWSERS = 'legacy-browsers',
}

type DynamicSamplingConditionLogicalInnerGlob = {
  op: DynamicSamplingInnerOperator.GLOB_MATCH;
  name: DynamicSamplingInnerName;
  value: Array<string>;
};

type DynamicSamplingConditionLogicalInnerEq = {
  op: DynamicSamplingInnerOperator.EQUAL;
  name: DynamicSamplingInnerName;
  value: Array<string>;
  ignoreCase: boolean;
};

export type DynamicSamplingConditionLogicalInner =
  | DynamicSamplingConditionLogicalInnerGlob
  | DynamicSamplingConditionLogicalInnerEq;

export type DynamicSamplingConditionNegation = {
  op: DynamicSamplingConditionOperator.NOT;
  inner: DynamicSamplingConditionLogicalInner;
};

export type DynamicSamplingConditionMultiple = {
  op: DynamicSamplingConditionOperator.AND | DynamicSamplingConditionOperator.OR;
  inner: Array<DynamicSamplingConditionLogicalInner>;
};

export type DynamicSamplingCondition =
  | DynamicSamplingConditionNegation
  | DynamicSamplingConditionMultiple;

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
  type: DynamicSamplingRuleType;
};

export type DynamicSamplingRules = Array<DynamicSamplingRule>;
