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
  /**
   * Custom Operation
   */
  CUSTOM = 'custom',
}

export enum DynamicSamplingInnerName {
  TRACE_RELEASE = 'trace.release',
  TRACE_ENVIRONMENT = 'trace.environment',
  TRACE_USER_ID = 'trace.user.id',
  TRACE_USER_SEGMENT = 'trace.user.segment',
  EVENT_RELEASE = 'event.release',
  EVENT_ENVIRONMENT = 'event.environment',
  EVENT_USER_ID = 'event.user.id',
  EVENT_USER_SEGMENT = 'event.user.segment',
  EVENT_LOCALHOST = 'event.is_local_ip',
  EVENT_WEB_CRAWLERS = 'event.web_crawlers',
  EVENT_BROWSER_EXTENSIONS = 'event.has_bad_browser_extensions',
  EVENT_LEGACY_BROWSER = 'event.legacy_browser',
}

export enum LegacyBrowser {
  IE_PRE_9 = 'ie_pre_9',
  IE9 = 'ie9',
  IE10 = 'ie10',
  IE11 = 'ie11',
  SAFARI_PRE_6 = 'safari_pre_6',
  OPERA_PRE_15 = 'opera_pre_15',
  OPERA_MINI_PRE_8 = 'opera_mini_pre_8',
  ANDROID_PRE_4 = 'android_pre_4',
}

type DynamicSamplingConditionLogicalInnerGlob = {
  op: DynamicSamplingInnerOperator.GLOB_MATCH;
  name: DynamicSamplingInnerName.EVENT_RELEASE | DynamicSamplingInnerName.TRACE_RELEASE;
  value: Array<string>;
};

type DynamicSamplingConditionLogicalInnerEq = {
  op: DynamicSamplingInnerOperator.EQUAL;
  name:
    | DynamicSamplingInnerName.EVENT_ENVIRONMENT
    | DynamicSamplingInnerName.TRACE_ENVIRONMENT
    | DynamicSamplingInnerName.EVENT_USER_ID
    | DynamicSamplingInnerName.TRACE_USER_ID
    | DynamicSamplingInnerName.EVENT_USER_SEGMENT
    | DynamicSamplingInnerName.TRACE_USER_SEGMENT;
  value: Array<string>;
  options: {
    ignoreCase: boolean;
  };
};

type DynamicSamplingConditionLogicalInnerEqBoolean = {
  op: DynamicSamplingInnerOperator.EQUAL;
  name:
    | DynamicSamplingInnerName.EVENT_BROWSER_EXTENSIONS
    | DynamicSamplingInnerName.EVENT_LOCALHOST
    | DynamicSamplingInnerName.EVENT_WEB_CRAWLERS;
  value: boolean;
};

type DynamicSamplingConditionLogicalInnerCustom = {
  op: DynamicSamplingInnerOperator.CUSTOM;
  name: DynamicSamplingInnerName.EVENT_LEGACY_BROWSER;
  value: Array<LegacyBrowser>;
};

export type DynamicSamplingConditionLogicalInner =
  | DynamicSamplingConditionLogicalInnerGlob
  | DynamicSamplingConditionLogicalInnerEq
  | DynamicSamplingConditionLogicalInnerEqBoolean
  | DynamicSamplingConditionLogicalInnerCustom;

export type DynamicSamplingCondition = {
  op: DynamicSamplingConditionOperator.AND;
  inner: Array<DynamicSamplingConditionLogicalInner>;
};

export type DynamicSamplingRule = {
  /**
   * This is a unique number within a project
   */
  id: number;
  /**
   * Describes the type of rule
   */
  type: DynamicSamplingRuleType;
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
};

export type DynamicSamplingRules = Array<DynamicSamplingRule>;
