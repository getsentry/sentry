import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {DataCategoryExact} from 'sentry/types/core';

import type {BilledDataCategoryInfo} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';

export const MONTHLY = 'monthly';
export const ANNUAL = 'annual';

export const MILLION = 1_000_000;
export const BILLION = 1_000_000_000;

export const UNLIMITED = '∞';
export const UNLIMITED_RESERVED = -1;
export const RESERVED_BUDGET_QUOTA = -2;
export const CPE_MULTIPLIER_TO_CENTS = 0.000001;

export const GIGABYTE = 10 ** 9;

// the first tier is the default tier
export const SUPPORTED_TIERS = [PlanTier.AM3, PlanTier.AM2, PlanTier.AM1];
export const DEFAULT_TIER = SUPPORTED_TIERS[0];
export const UPSELL_TIER = SUPPORTED_TIERS[1]; // TODO(am3): Update to DEFAULT_TIER when upsells are configured for AM3

const BASIC_TRIAL_PLANS = ['am1_t', 'am2_t', 'am3_t'];
const ENTERPRISE_TRIAL_PLANS = ['am1_t_ent', 'am2_t_ent', 'am3_t_ent', 'am3_t_ent_ds'];
export const TRIAL_PLANS = [...BASIC_TRIAL_PLANS, ...ENTERPRISE_TRIAL_PLANS];

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

/**
 * Extension of DATA_CATEGORY_INFO with billing info for billed categories.
 * All categories with isBilledCategory: true, should be explicitly
 * added to this object with billing info.
 */
export const BILLED_DATA_CATEGORY_INFO = {
  ...DATA_CATEGORY_INFO,
  [DataCategoryExact.ERROR]: {
    ...DATA_CATEGORY_INFO[DataCategoryExact.ERROR],
    canAllocate: true,
    canProductTrial: false,
    maxAdminGift: 10_000_000,
    freeEventsMultiple: 1_000,
    feature: null,
  },
  [DataCategoryExact.TRANSACTION]: {
    ...DATA_CATEGORY_INFO[DataCategoryExact.TRANSACTION],
    canAllocate: true,
    canProductTrial: true,
    maxAdminGift: 50_000_000,
    freeEventsMultiple: 1_000,
    feature: 'performance-view',
  },
  [DataCategoryExact.ATTACHMENT]: {
    ...DATA_CATEGORY_INFO[DataCategoryExact.ATTACHMENT],
    canAllocate: true,
    canProductTrial: false,
    maxAdminGift: 10_000,
    freeEventsMultiple: 1,
    feature: 'event-attachments',
  },
  [DataCategoryExact.REPLAY]: {
    ...DATA_CATEGORY_INFO[DataCategoryExact.REPLAY],
    canAllocate: false,
    canProductTrial: true,
    maxAdminGift: 1_000_000,
    freeEventsMultiple: 1,
    feature: 'session-replay',
  },
  [DataCategoryExact.SPAN]: {
    ...DATA_CATEGORY_INFO[DataCategoryExact.SPAN],
    canAllocate: false,
    canProductTrial: true,
    maxAdminGift: 1_000_000_000,
    freeEventsMultiple: 100_000,
    feature: 'spans-usage-tracking',
  },
  [DataCategoryExact.SPAN_INDEXED]: {
    ...DATA_CATEGORY_INFO[DataCategoryExact.SPAN_INDEXED],
    canAllocate: false,
    canProductTrial: true,
    maxAdminGift: 1_000_000_000,
    freeEventsMultiple: 100_000,
    feature: 'spans-usage-tracking',
  },
  [DataCategoryExact.MONITOR_SEAT]: {
    ...DATA_CATEGORY_INFO[DataCategoryExact.MONITOR_SEAT],
    canAllocate: false,
    canProductTrial: false,
    maxAdminGift: 10_000,
    freeEventsMultiple: 1,
    feature: 'monitor-seat-billing',
  },
  [DataCategoryExact.UPTIME]: {
    ...DATA_CATEGORY_INFO[DataCategoryExact.UPTIME],
    canAllocate: false,
    canProductTrial: false,
    maxAdminGift: 10_000,
    freeEventsMultiple: 1,
    feature: 'uptime',
  },
  [DataCategoryExact.PROFILE_DURATION]: {
    ...DATA_CATEGORY_INFO[DataCategoryExact.PROFILE_DURATION],
    canAllocate: false,
    canProductTrial: true,
    maxAdminGift: 10_000,
    freeEventsMultiple: 1, // in hours
    feature: null,
  },
  [DataCategoryExact.PROFILE_DURATION_UI]: {
    ...DATA_CATEGORY_INFO[DataCategoryExact.PROFILE_DURATION_UI],
    canAllocate: false,
    canProductTrial: true,
    maxAdminGift: 10_000,
    freeEventsMultiple: 1, // in hours
    feature: null,
  },
} as const satisfies Record<DataCategoryExact, BilledDataCategoryInfo>;
