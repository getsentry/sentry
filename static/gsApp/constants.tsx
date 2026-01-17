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
const SUPPORTED_TIERS = [PlanTier.AM3, PlanTier.AM2, PlanTier.AM1];
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
      checkoutTooltip: null,
      tallyType: 'usage',
      hasPerCategory: false,
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
    maxAdminGift: 10_000_000,
    freeEventsMultiple: 1_000,
    hasSpikeProtection: true,
    checkoutTooltip: t(
      'Errors are sent every time an SDK catches a bug. You can send them manually too, if you want.'
    ),
    hasPerCategory: true,
  },
  [DataCategoryExact.TRANSACTION]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.TRANSACTION],
    canAllocate: true,
    canProductTrial: true,
    maxAdminGift: 50_000_000,
    freeEventsMultiple: 1_000,
    feature: 'performance-view',
    hasSpikeProtection: true,
    checkoutTooltip: t(
      'Transactions are sent when your service receives a request and sends a response.'
    ),
    hasPerCategory: true,
    shortenedUnitName: t('unit'),
  },
  [DataCategoryExact.ATTACHMENT]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.ATTACHMENT],
    canAllocate: true,
    maxAdminGift: 10_000,
    freeEventsMultiple: 1,
    feature: 'event-attachments',
    hasSpikeProtection: true,
    checkoutTooltip: t('Attachments are files attached to errors, such as minidumps.'),
    hasPerCategory: true,
    shortenedUnitName: 'GB',
  },
  [DataCategoryExact.REPLAY]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.REPLAY],
    canProductTrial: true,
    maxAdminGift: 1_000_000,
    freeEventsMultiple: 1,
    feature: 'session-replay',
    checkoutTooltip: t(
      'Session Replays are video-like reproductions of your users’ sessions navigating your app or website.'
    ),
    hasPerCategory: true,
  },
  [DataCategoryExact.SPAN]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.SPAN],
    canProductTrial: true,
    maxAdminGift: 1_000_000_000,
    freeEventsMultiple: 100_000,
    feature: 'spans-usage-tracking',
    hasSpikeProtection: true,
    checkoutTooltip: t(
      'Tracing is enabled by spans. A span represents a single operation of work within a trace.'
    ),
  },
  [DataCategoryExact.SPAN_INDEXED]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.SPAN_INDEXED],
    canProductTrial: true,
    maxAdminGift: 1_000_000_000,
    freeEventsMultiple: 100_000,
    feature: 'spans-usage-tracking',
  },
  [DataCategoryExact.MONITOR_SEAT]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.MONITOR_SEAT],
    maxAdminGift: 10_000,
    freeEventsMultiple: 1,
    feature: 'monitor-seat-billing',
    tallyType: 'seat',
    hasPerCategory: true,
    checkoutTooltip: t(
      'Crons monitors scheduled jobs to confirm they run on time and alert you when they fail or misfire.'
    ),
    shortenedUnitName: t('monitor'),
  },
  [DataCategoryExact.UPTIME]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.UPTIME],
    maxAdminGift: 10_000,
    freeEventsMultiple: 1,
    feature: 'uptime-billing',
    tallyType: 'seat',
    hasPerCategory: true,
    checkoutTooltip: t(
      'Uptime monitoring checks your application’s availability and alerts you when services go down so you can respond quickly.'
    ),
    shortenedUnitName: t('monitor'),
  },
  [DataCategoryExact.PROFILE_DURATION]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.PROFILE_DURATION],
    canProductTrial: true,
    maxAdminGift: 10_000,
    freeEventsMultiple: 1, // in hours
    hasPerCategory: true,
    checkoutTooltip: t(
      'Continuous profiling tracks how code runs while your service is active, helping you find bottlenecks and improve efficiency.'
    ),
    shortenedUnitName: t('hour'),
  },
  [DataCategoryExact.PROFILE_DURATION_UI]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.PROFILE_DURATION_UI],
    canProductTrial: true,
    maxAdminGift: 10_000,
    freeEventsMultiple: 1, // in hours
    hasPerCategory: true,
    checkoutTooltip: t(
      'UI profiling tracks code performance during user sessions in frontend or mobile apps, helping you spot slowdowns and improve experience.'
    ),
    shortenedUnitName: t('hour'),
  },
  // Seer categories have product trials through ReservedBudgetCategoryType.SEER, not as individual categories
  [DataCategoryExact.SEER_AUTOFIX]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.SEER_AUTOFIX],
    feature: 'seer-billing',
    shortenedUnitName: t('fix'),
  },
  [DataCategoryExact.SEER_SCANNER]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.SEER_SCANNER],
    feature: 'seer-billing',
    shortenedUnitName: t('scan'),
  },
  [DataCategoryExact.LOG_BYTE]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.LOG_BYTE],
    canAllocate: false,
    canProductTrial: true,
    maxAdminGift: 10_000,
    freeEventsMultiple: 1,
    hasSpikeProtection: false,
    feature: 'logs-billing',
    checkoutTooltip: t(
      'A log records events from your application, giving you the context to debug issues and understand system behavior.'
    ),
    shortenedUnitName: 'GB',
  },
  [DataCategoryExact.SEER_USER]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.SEER_USER],
    feature: 'seer-user-billing',
    canProductTrial: false,
    maxAdminGift: 100,
    freeEventsMultiple: 1,
    tallyType: 'seat',
    shortenedUnitName: t('contributor'),
  },
} as const satisfies Record<DataCategoryExact, BilledDataCategoryInfo>;
