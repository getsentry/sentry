export const MONTHLY = 'monthly';
export const ANNUAL = 'annual';

export const MILLION = 1_000_000;
export const BILLION = 1_000_000_000;

export const UNLIMITED = '∞';
export const UNLIMITED_RESERVED = -1;
export const RESERVED_BUDGET_QUOTA = -2;
export const CPE_MULTIPLIER_TO_CENTS = 0.000001;

export const GIGABYTE = 10 ** 9;

/**
 * Pseudo-tiers accepted by the customer billing-config endpoint as its `tier`
 * query param. The backend resolves each server-side so the frontend doesn't
 * have to replicate the selection logic. See getsentry's
 * `CustomerBillingConfigEndpoint`.
 */
export enum BillingConfigTier {
  /** Tier to show in upsells: AM3 for AM3 customers, otherwise AM2. */
  UPSELL = 'upsell',
  /** Tier a customer should check out on. */
  CHECKOUT = 'checkout',
  /** The latest tier, independent of the org's current plan. */
  DEFAULT = 'default',
  /** Plans across all usable tiers (staff/superuser only). */
  ALL = 'all',
}

// While we no longer offer or support unlimited ondemand we still
// need to render billing history records that have unlimited ondemand.
export const UNLIMITED_ONDEMAND = -1;

// Default PAYG budgets for Business and Team plans
export const PAYG_BUSINESS_DEFAULT = 300_00;
export const PAYG_TEAM_DEFAULT = 100_00;

export const DEFAULT_TRIAL_DAYS = 14;

export enum AllocationTargetTypes {
  PROJECT = 'Project',
  ORGANIZATION = 'Organization',
}
