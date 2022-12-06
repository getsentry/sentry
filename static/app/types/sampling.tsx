export enum DynamicSamplingBiasType {
  BOOST_ENVIRONMENTS = 'boostEnvironments',
  BOOST_LATEST_RELEASES = 'boostLatestRelease',
  BOOST_KEY_TRANSACTIONS = 'boostKeyTransactions',
  IGNORE_HEALTH_CHECKS = 'ignoreHealthChecks',
}

export type DynamicSamplingBias = {
  active: boolean;
  id: DynamicSamplingBiasType;
};
