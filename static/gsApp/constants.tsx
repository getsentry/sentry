import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {t} from 'sentry/locale';
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

// XXX: initialize the BilledDataCategoryInfo-specific field for all non-billed
// `categories and make TS happy so we can access the BilledDataCategoryInfo
// fields directly without needing to check that they exist on the object
const DEFAULT_BILLED_DATA_CATEGORY_INFO = {
  ...DATA_CATEGORY_INFO,
} as Record<DataCategoryExact, BilledDataCategoryInfo>;
Object.entries(DEFAULT_BILLED_DATA_CATEGORY_INFO).forEach(
  ([categoryExact, categoryInfo]) => {
    DEFAULT_BILLED_DATA_CATEGORY_INFO[categoryExact as DataCategoryExact] = {
      ...categoryInfo,
      canAllocate: false,
      canProductTrial: false,
      maxAdminGift: 0,
      freeEventsMultiple: 0,
      feature: null,
      hasSpikeProtection: false,
      reservedVolumeTooltip: null,
    };
  }
);

/**
 * Extension of DATA_CATEGORY_INFO with billing info for billed categories.
 * All categories with isBilledCategory: true, should be explicitly
 * added to this object with billing info.
 */
export const BILLED_DATA_CATEGORY_INFO = {
  ...DEFAULT_BILLED_DATA_CATEGORY_INFO,
  [DataCategoryExact.ERROR]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.ERROR],
    canAllocate: true,
    canProductTrial: false,
    maxAdminGift: 10_000_000,
    freeEventsMultiple: 1_000,
    hasSpikeProtection: true,
    reservedVolumeTooltip: t(
      'Errors are sent every time an SDK catches a bug. You can send them manually too, if you want.'
    ),
  },
  [DataCategoryExact.TRANSACTION]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.TRANSACTION],
    canAllocate: true,
    canProductTrial: true,
    maxAdminGift: 50_000_000,
    freeEventsMultiple: 1_000,
    feature: 'performance-view',
    hasSpikeProtection: true,
    reservedVolumeTooltip: t(
      'Transactions are sent when your service receives a request and sends a response.'
    ),
  },
  [DataCategoryExact.ATTACHMENT]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.ATTACHMENT],
    canAllocate: true,
    canProductTrial: false,
    maxAdminGift: 10_000,
    freeEventsMultiple: 1,
    feature: 'event-attachments',
    hasSpikeProtection: true,
    reservedVolumeTooltip: t(
      'Attachments are files attached to errors, such as minidumps.'
    ),
  },
  [DataCategoryExact.REPLAY]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.REPLAY],
    canAllocate: false,
    canProductTrial: true,
    maxAdminGift: 1_000_000,
    freeEventsMultiple: 1,
    feature: 'session-replay',
    reservedVolumeTooltip: t(
      'Session Replays are video-like reproductions of your users’ sessions navigating your app or website.'
    ),
  },
  [DataCategoryExact.SPAN]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.SPAN],
    canAllocate: false,
    canProductTrial: true,
    maxAdminGift: 1_000_000_000,
    freeEventsMultiple: 100_000,
    feature: 'spans-usage-tracking',
    hasSpikeProtection: true,
    reservedVolumeTooltip: t(
      'Tracing is enabled by spans. A span represents a single operation of work within a trace.'
    ),
  },
  [DataCategoryExact.SPAN_INDEXED]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.SPAN_INDEXED],
    canAllocate: false,
    canProductTrial: true,
    maxAdminGift: 1_000_000_000,
    freeEventsMultiple: 100_000,
    feature: 'spans-usage-tracking',
  },
  [DataCategoryExact.MONITOR_SEAT]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.MONITOR_SEAT],
    canAllocate: false,
    canProductTrial: false,
    maxAdminGift: 10_000,
    freeEventsMultiple: 1,
    feature: 'monitor-seat-billing',
  },
  [DataCategoryExact.UPTIME]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.UPTIME],
    canAllocate: false,
    canProductTrial: false,
    maxAdminGift: 10_000,
    freeEventsMultiple: 1,
    feature: 'uptime-billing',
  },
  [DataCategoryExact.PROFILE_DURATION]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.PROFILE_DURATION],
    canAllocate: false,
    canProductTrial: true,
    maxAdminGift: 10_000,
    freeEventsMultiple: 1, // in hours
    feature: null,
  },
  [DataCategoryExact.PROFILE_DURATION_UI]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.PROFILE_DURATION_UI],
    canAllocate: false,
    canProductTrial: true,
    maxAdminGift: 10_000,
    freeEventsMultiple: 1, // in hours
    feature: null,
  },
  [DataCategoryExact.SEER_AUTOFIX]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.SEER_AUTOFIX],
    canAllocate: false,
    canProductTrial: false,
    maxAdminGift: 0,
    freeEventsMultiple: 0,
    feature: 'seer-billing',
  },
  [DataCategoryExact.SEER_SCANNER]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.SEER_SCANNER],
    canAllocate: false,
    canProductTrial: false,
    maxAdminGift: 0,
    freeEventsMultiple: 0,
    feature: 'seer-billing',
  },
} as const satisfies Record<DataCategoryExact, BilledDataCategoryInfo>;
