import {Project} from './project';

export enum SamplingRuleType {
  /**
   * The rule applies to traces (transaction events considered in the context of a trace)
   */
  TRACE = 'trace',
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
}

/**
 * String of the sampling category that's used on the backend.
 * Default naming strategy should be based on the path in the event, prefixed with `event.`.
 * To see the path in the event, click on the JSON button on the issue details page.
 */
export enum SamplingInnerName {
  TRACE_RELEASE = 'trace.release',
  TRACE_ENVIRONMENT = 'trace.environment',
}

type SamplingConditionLogicalInnerGlob = {
  name: SamplingInnerName.TRACE_RELEASE;
  op: SamplingInnerOperator.GLOB_MATCH;
  value: Array<string>;
};

type SamplingConditionLogicalInnerEq = {
  name: SamplingInnerName.TRACE_ENVIRONMENT;

  op: SamplingInnerOperator.EQUAL;
  options: {
    ignoreCase: boolean;
  };
  value: Array<string>;
};

export type SamplingConditionLogicalInner =
  | SamplingConditionLogicalInnerGlob
  | SamplingConditionLogicalInnerEq;

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
};

export type SamplingDistribution = {
  endTimestamp: string | null;
  parentProjectBreakdown:
    | null
    | {
        percentage: number;
        project: string;
        projectId: number;
      }[];
  projectBreakdown:
    | null
    | {
        'count()': number;
        project: string;
        projectId: number;
      }[];
  sampleSize: number;
  startTimestamp: string | null;
};

export type SamplingSdkVersion = {
  isSendingSampleRate: boolean;
  isSendingSource: boolean;
  isSupportedPlatform: boolean;
  latestSDKName: string;
  latestSDKVersion: string;
  project: string;
};

export type RecommendedSdkUpgrade = {
  latestSDKName: SamplingSdkVersion['latestSDKName'];
  latestSDKVersion: SamplingSdkVersion['latestSDKVersion'];
  project: Project;
};

export type UniformModalsSubmit = (props: {
  sampleRate: number;
  uniformRateModalOrigin: boolean;
  onError?: () => void;
  onSuccess?: (newRules: SamplingRule[]) => void;
  recommendedSampleRate?: boolean;
  rule?: SamplingRule;
}) => void;

export enum DynamicSamplingBiasType {
  BOOST_ENVIRONMENTS = 'boostEnvironments',
  BOOST_LATEST_RELEASES = 'boostLatestRelease',
  IGNORE_HEALTH_CHECKS = 'ignoreHealthChecks',
}

export type DynamicSamplingBias = {
  active: boolean;
  id: DynamicSamplingBiasType;
};
