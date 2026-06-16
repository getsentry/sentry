/**
 * Plan tier identifiers, used only by tests/fixtures.
 *
 * Production code no longer branches on tier identity (it relies on
 * backend-resolved tiers and plan capabilities), so this enum lives in the test
 * tree to keep it out of the production bundle/exports.
 */
export enum PlanTier {
  /**
   * Performance plans with continuous profiling
   * and dynamic sampling for spans.
   */
  AM3 = 'am3',
  /**
   * Performance plans with continuous profiling
   * and dynamic sampling for transactions.
   */
  AM2 = 'am2',
  /**
   * First generation of application monitoring plans.
   * Includes performance features.
   */
  AM1 = 'am1',
  /**
   * No specified tier
   */
  ALL = 'all',
  /**
   * Test plans
   */
  TEST = 'test',
}
