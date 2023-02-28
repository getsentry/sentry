export enum DynamicSamplingBiasType {
  BOOST_ENVIRONMENTS = 'boostEnvironments',
  BOOST_LATEST_RELEASES = 'boostLatestRelease',
  BOOST_KEY_TRANSACTIONS = 'boostKeyTransactions',
  BOOST_LOW_VOLUME_TRANSACTIONS = 'boostLowVolumeTransactions',
  IGNORE_HEALTH_CHECKS = 'ignoreHealthChecks',
}

export type DynamicSamplingBias = {
  active: boolean;
  id: DynamicSamplingBiasType;
};

enum SamplingConditionOperator {
  /**
   * Combine multiple sub-conditions with the operator 'and'
   */
  AND = 'and',
  OR = 'or',
}

type DynamicSamplingConditionLogicalInner = {
  name: string;
  op: string;
  options: {
    ignoreCase: boolean;
  };
  value: string[];
};

type DynamicSamplingRuleCondition = {
  inner: DynamicSamplingConditionLogicalInner[];
  op: SamplingConditionOperator;
};

enum DynamicSamplingRuleType {
  /**
   * The rule applies to traces (transaction events considered in the context of a trace)
   */
  TRACE = 'trace',
  /**
   * The rule applies to transactions
   */
  TRANSACTION = 'transaction',
}

export type DynamicSamplingRule = {
  /**
   * Indicates if the rule is enabled or not
   */
  active: boolean;
  /**
   * It is a possibly empty list of conditions to which the rule applies
   */
  condition: DynamicSamplingRuleCondition;
  /**
   * This is a unique number within a project
   */
  id: number;
  /**
   * It is the sampling rate that is applied
   */
  sampleRate: number;
  /**
   * Describes the type of rule
   */
  type: DynamicSamplingRuleType;
};
