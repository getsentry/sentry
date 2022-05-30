export enum DynamicSamplingRuleType {
  /**
   * The rule applies to traces (transaction events considered in the context of a trace)
   */
  TRACE = 'trace',
  /**
   *  The rule applies to transaction events considered independently
   */
  TRANSACTION = 'transaction',
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

/**
 * String of the sampling category that's used on the backend.
 * Default naming strategy should be based on the path in the event, prefixed with `event.`.
 * To see the path in the event, click on the JSON button on the issue details page.
 */
export enum DynamicSamplingInnerName {
  TRACE_RELEASE = 'trace.release',
  TRACE_ENVIRONMENT = 'trace.environment',
  TRACE_USER_ID = 'trace.user.id',
  TRACE_USER_SEGMENT = 'trace.user.segment',
  TRACE_TRANSACTION = 'trace.transaction',
  EVENT_RELEASE = 'event.release',
  EVENT_ENVIRONMENT = 'event.environment',
  EVENT_USER_ID = 'event.user.id',
  EVENT_USER_SEGMENT = 'event.user.segment',
  EVENT_LOCALHOST = 'event.is_local_ip',
  EVENT_WEB_CRAWLERS = 'event.web_crawlers',
  EVENT_BROWSER_EXTENSIONS = 'event.has_bad_browser_extensions',
  EVENT_TRANSACTION = 'event.transaction',
  EVENT_OS_NAME = 'event.contexts.os.name',
  EVENT_OS_VERSION = 'event.contexts.os.version',
  EVENT_DEVICE_NAME = 'event.contexts.device.name',
  EVENT_DEVICE_FAMILY = 'event.contexts.device.family',
  // Custom operators
  EVENT_IP_ADDRESSES = 'event.client_ip',
  EVENT_LEGACY_BROWSER = 'event.legacy_browser',
  EVENT_ERROR_MESSAGES = 'event.error_messages',
  EVENT_CSP = 'event.csp',
  EVENT_CUSTOM_TAG = 'event.custom_tag', // used for the fresh new custom tag condition (gets replaced once you choose tag key)
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
  name:
    | DynamicSamplingInnerName.EVENT_RELEASE
    | DynamicSamplingInnerName.TRACE_RELEASE
    | DynamicSamplingInnerName.EVENT_TRANSACTION
    | DynamicSamplingInnerName.TRACE_TRANSACTION
    | DynamicSamplingInnerName.EVENT_OS_NAME
    | DynamicSamplingInnerName.EVENT_OS_VERSION
    | DynamicSamplingInnerName.EVENT_DEVICE_FAMILY
    | DynamicSamplingInnerName.EVENT_DEVICE_NAME
    | DynamicSamplingInnerName.EVENT_CUSTOM_TAG
    | string; // for custom tags
  op: DynamicSamplingInnerOperator.GLOB_MATCH;
  value: Array<string>;
};

type DynamicSamplingConditionLogicalInnerEq = {
  name:
    | DynamicSamplingInnerName.EVENT_ENVIRONMENT
    | DynamicSamplingInnerName.TRACE_ENVIRONMENT
    | DynamicSamplingInnerName.EVENT_USER_ID
    | DynamicSamplingInnerName.TRACE_USER_ID
    | DynamicSamplingInnerName.EVENT_USER_SEGMENT
    | DynamicSamplingInnerName.TRACE_USER_SEGMENT;
  op: DynamicSamplingInnerOperator.EQUAL;
  options: {
    ignoreCase: boolean;
  };
  value: Array<string>;
};

type DynamicSamplingConditionLogicalInnerEqBoolean = {
  name:
    | DynamicSamplingInnerName.EVENT_BROWSER_EXTENSIONS
    | DynamicSamplingInnerName.EVENT_LOCALHOST
    | DynamicSamplingInnerName.EVENT_WEB_CRAWLERS;
  op: DynamicSamplingInnerOperator.EQUAL;
  value: boolean;
};

type DynamicSamplingConditionLogicalInnerCustom = {
  name:
    | DynamicSamplingInnerName.EVENT_CSP
    | DynamicSamplingInnerName.EVENT_ERROR_MESSAGES
    | DynamicSamplingInnerName.EVENT_IP_ADDRESSES;
  op: DynamicSamplingInnerOperator.CUSTOM;
  value: Array<string>;
};

type DynamicSamplingConditionLogicalInnerCustomLegacyBrowser = {
  name: DynamicSamplingInnerName.EVENT_LEGACY_BROWSER;
  op: DynamicSamplingInnerOperator.CUSTOM;
  value: Array<LegacyBrowser>;
};

export type DynamicSamplingConditionLogicalInner =
  | DynamicSamplingConditionLogicalInnerGlob
  | DynamicSamplingConditionLogicalInnerEq
  | DynamicSamplingConditionLogicalInnerEqBoolean
  | DynamicSamplingConditionLogicalInnerCustom
  | DynamicSamplingConditionLogicalInnerCustomLegacyBrowser;

export type DynamicSamplingCondition = {
  inner: Array<DynamicSamplingConditionLogicalInner>;
  op: DynamicSamplingConditionOperator.AND;
};

export type DynamicSamplingRule = {
  /**
   * It is a possibly empty list of conditions to which the rule applies.
   * The conditions are combined using the and operator (so all the conditions must be satisfied for the rule to apply).
   * If the conditions field is an empty list the rule applies for all events that satisfy the projectIds and the ty fields.
   */
  condition: DynamicSamplingCondition;
  /**
   * This is a unique number within a project
   */
  id: number;
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
