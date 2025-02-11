import {DataCategory, DataCategoryExact} from 'sentry/types/core';

import {PlanTier} from 'getsentry/types';

export const MONTHLY = 'monthly';
export const ANNUAL = 'annual';

export const MILLION = 1_000_000;
export const BILLION = 1_000_000_000;

export const UNLIMITED = '∞';
export const UNLIMITED_RESERVED = -1;
export const RESERVED_BUDGET_QUOTA = -2;

export const GIGABYTE = 10 ** 9;

// the first tier is the default tier
export const SUPPORTED_TIERS = [PlanTier.AM3, PlanTier.AM2, PlanTier.AM1];
export const DEFAULT_TIER = SUPPORTED_TIERS[0];
export const UPSELL_TIER = SUPPORTED_TIERS[1]; // TODO(am3): Update to DEFAULT_TIER when upsells are configured for AM3

const BASIC_TRIAL_PLANS = ['am1_t', 'am2_t', 'am3_t'];
const ENTERPRISE_TRIAL_PLANS = ['am1_t_ent', 'am2_t_ent', 'am3_t_ent'];
export const TRIAL_PLANS = [...BASIC_TRIAL_PLANS, ...ENTERPRISE_TRIAL_PLANS];

export const MAX_ADMIN_CATEGORY_GIFTS = {
  [DataCategory.ERRORS]: 10_000_000,
  [DataCategory.TRANSACTIONS]: 50_000_000,
  [DataCategory.ATTACHMENTS]: 10_000,
  [DataCategory.REPLAYS]: 1_000_000,
  [DataCategory.MONITOR_SEATS]: 10_000,
  [DataCategory.UPTIME]: 10_000,
  [DataCategory.SPANS]: 1_000_000_000,
  [DataCategory.PROFILE_DURATION]: 10_000, // TODO(continuous profiling): confirm max amount
};

// While we no longer offer or support unlimited ondemand we still
// need to render billing history records that have unlimited ondemand.
export const UNLIMITED_ONDEMAND = -1;

export const DEFAULT_TRIAL_DAYS = 14;

export enum AllocationTargetTypes {
  PROJECT = 'Project',
  ORGANIZATION = 'Organization',
}

export const ALLOCATION_SUPPORTED_CATEGORIES: DataCategoryExact[] = [
  DataCategoryExact.ERROR,
  DataCategoryExact.TRANSACTION,
  DataCategoryExact.ATTACHMENT,
];

export const PRODUCT_TRIAL_CATEGORIES: DataCategory[] = [
  DataCategory.REPLAYS,
  DataCategory.SPANS,
  DataCategory.TRANSACTIONS,
];
