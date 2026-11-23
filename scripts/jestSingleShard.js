/**
 * Small isolated suites run once, while the shared Jest config balances larger
 * suites across CI shards. Local and unsharded CI runs always run these tests.
 * @template {object} T
 * @param {T} config
 */
export function runOnFirstShard(config) {
  const skip =
    process.env.CI &&
    process.env.CI_NODE_TOTAL &&
    process.env.CI_NODE_INDEX &&
    process.env.CI_NODE_INDEX !== '0';
  return skip
    ? {
        ...config,
        testMatch: ['<rootDir>/__no_tests_for_this_shard__'],
        passWithNoTests: true,
      }
    : config;
}
