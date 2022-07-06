export enum SamplingRuleType {
  /**
   * The rule applies to traces (transaction events considered in the context of a trace)
   */
  TRACE = 'trace',
  /**
   *  The rule applies to transaction events considered independently
   */
  TRANSACTION = 'transaction',
}

export enum SamplingConditionOperator {
  /**
   * Combine multiple sub-conditions with the operator 'and'
   */
  AND = 'and',
}

export enum SamplingRuleOperator {
  /**
   * The first rule on the list
   */
  IF = 'if',
  /**
   * All other rules, except rules without a condition
   */
  ELSE_IF = 'else_if',
  /**
   * Rules without a condition. In this case the rule cannot be reordered and is “pinned” at the bottom of the list
   */
  ELSE = 'else',
}

export enum SamplingInnerOperator {
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
export enum SamplingInnerName {
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
  EVENT_TRANSACTION = 'event.transaction',
  EVENT_OS_NAME = 'event.contexts.os.name',
  EVENT_OS_VERSION = 'event.contexts.os.version',
  EVENT_DEVICE_NAME = 'event.contexts.device.name',
  EVENT_DEVICE_FAMILY = 'event.contexts.device.family',
  // Custom operators
  EVENT_IP_ADDRESSES = 'event.client_ip',
  EVENT_LEGACY_BROWSER = 'event.legacy_browser',
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

type SamplingConditionLogicalInnerGlob = {
  name:
    | SamplingInnerName.EVENT_RELEASE
    | SamplingInnerName.TRACE_RELEASE
    | SamplingInnerName.EVENT_TRANSACTION
    | SamplingInnerName.TRACE_TRANSACTION
    | SamplingInnerName.EVENT_OS_NAME
    | SamplingInnerName.EVENT_OS_VERSION
    | SamplingInnerName.EVENT_DEVICE_FAMILY
    | SamplingInnerName.EVENT_DEVICE_NAME
    | SamplingInnerName.EVENT_CUSTOM_TAG
    | string; // for custom tags
  op: SamplingInnerOperator.GLOB_MATCH;
  value: Array<string>;
};

type SamplingConditionLogicalInnerEq = {
  name:
    | SamplingInnerName.EVENT_ENVIRONMENT
    | SamplingInnerName.TRACE_ENVIRONMENT
    | SamplingInnerName.EVENT_USER_ID
    | SamplingInnerName.TRACE_USER_ID
    | SamplingInnerName.EVENT_USER_SEGMENT
    | SamplingInnerName.TRACE_USER_SEGMENT;
  op: SamplingInnerOperator.EQUAL;
  options: {
    ignoreCase: boolean;
  };
  value: Array<string>;
};

type SamplingConditionLogicalInnerEqBoolean = {
  name: SamplingInnerName.EVENT_LOCALHOST | SamplingInnerName.EVENT_WEB_CRAWLERS;
  op: SamplingInnerOperator.EQUAL;
  value: boolean;
};

type SamplingConditionLogicalInnerCustom = {
  name: SamplingInnerName.EVENT_CSP | SamplingInnerName.EVENT_IP_ADDRESSES;
  op: SamplingInnerOperator.CUSTOM;
  value: Array<string>;
};

type SamplingConditionLogicalInnerCustomLegacyBrowser = {
  name: SamplingInnerName.EVENT_LEGACY_BROWSER;
  op: SamplingInnerOperator.CUSTOM;
  value: Array<LegacyBrowser>;
};

export type SamplingConditionLogicalInner =
  | SamplingConditionLogicalInnerGlob
  | SamplingConditionLogicalInnerEq
  | SamplingConditionLogicalInnerEqBoolean
  | SamplingConditionLogicalInnerCustom
  | SamplingConditionLogicalInnerCustomLegacyBrowser;

export type SamplingCondition = {
  inner: Array<SamplingConditionLogicalInner>;
  op: SamplingConditionOperator.AND;
};

export type SamplingRule = {
  /**
   * It is a possibly empty list of conditions to which the rule applies.
   * The conditions are combined using the and operator (so all the conditions must be satisfied for the rule to apply).
   * If the conditions field is an empty list the rule applies for all events that satisfy the projectIds and the ty fields.
   */
  condition: SamplingCondition;
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
  type: SamplingRuleType;
  /**
   * Indicates if the rule is enabled for server-side sampling
   */
  active?: boolean;
  /**
   * A rule without a condition (Else case) always have to be 'pinned'
   * to the bottom of the list and cannot be sorted.
   */
  bottomPinned?: boolean;
};

export type SamplingRules = Array<SamplingRule>;

export type SamplingDistribution = {
  null_sample_rate_percentage: null | number;
  project_breakdown:
    | null
    | {
        'count()': number;
        project: string;
        project_id: number;
      }[];
  sample_rate_distributions: null | {
    avg: null | number;
    max: null | number;
    min: null | number;
    p50: null | number;
    p90: null | number;
    p95: null | number;
    p99: null | number;
  };
  sample_size: number;
};

export type SamplingSdkVersion = {
  isSendingSampleRate: boolean;
  latestSDKName: string;
  latestSDKVersion: string;
  project: string;
};
