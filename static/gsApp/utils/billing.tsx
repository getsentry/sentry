import moment from 'moment-timezone';

import type {PromptData} from 'sentry/actionCreators/prompts';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';

import {
  BILLION,
  DEFAULT_TRIAL_DAYS,
  GIGABYTE,
  MILLION,
  RESERVED_BUDGET_QUOTA,
  TRIAL_PLANS,
  UNLIMITED,
  UNLIMITED_RESERVED,
} from 'getsentry/constants';
import type {
  BillingConfig,
  BillingMetricHistory,
  EventBucket,
  Plan,
  ProductTrial,
  Subscription,
} from 'getsentry/types';
import {PlanName, PlanTier} from 'getsentry/types';
import titleCase from 'getsentry/utils/titleCase';
import {displayPriceWithCents} from 'getsentry/views/amCheckout/utils';

export const MILLISECONDS_IN_HOUR = 3600_000;

function isNum(val: unknown): val is number {
  return typeof val === 'number';
}

// TODO(brendan): remove condition for 0 once -1 is the value we use to represent unlimited reserved quota
export function isUnlimitedReserved(value: number | null | undefined): boolean {
  return value === UNLIMITED_RESERVED;
}

export const getSlot = (
  events?: number,
  price?: number,
  slots?: EventBucket[],
  shouldMinimize = false
) => {
  let s = 0;
  if (!slots?.length || (typeof events !== 'number' && typeof price !== 'number')) {
    return 0;
  }
  const byEvents = typeof events === 'number';

  const value = isNum(events) ? events : isNum(price) ? price : null;
  if (value === null) {
    return 0;
  }

  const slotKey = byEvents ? 'events' : 'price';

  while (value > slots[s]![slotKey]) {
    s++;
    if (s >= slots.length - 1) {
      if (shouldMinimize) {
        return Math.max(s - 1, 0);
      }
      return Math.min(s, slots.length - 1);
    }
  }

  // If the specified number of events does not match any of the slots we have,
  // we return the slot down if shouldMinimize is true, otherwise we always return
  // the next slot up (ie. 500 events when the slots are [50, 5000] would return 50
  // when shouldMinimize is true, and 5000 when it is false or unspecified)
  if (
    shouldMinimize &&
    ((byEvents && slots[s]![slotKey] !== events) ||
      (!byEvents && slots[s]![slotKey] !== price))
  ) {
    return Math.max(s - 1, 0);
  }

  return Math.min(s, slots.length - 1);
};

type ReservedSku =
  | Subscription['reservedErrors']
  | Subscription['reservedTransactions']
  | Subscription['reservedAttachments']
  | number
  | null;

/**
 * isAbbreviated: Shortens the number using K for thousand, M for million, etc
 *                Useful for Errors/Transactions but not recommended to be used
 *                with Attachments because "1K GB" is hard to read.
 * isGifted: For gifted data volumes, 0 is displayed as 0 instead of unlimited.
 * useUnitScaling: For Attachments only. Scale from KB -> MB -> GB -> TB -> etc
 */
type FormatOptions = {
  fractionDigits?: number;
  isAbbreviated?: boolean;
  isGifted?: boolean;
  useUnitScaling?: boolean;
};

/**
 * This expects values from CustomerSerializer, which contains quota/reserved
 * quantities for the data categories that we sell.
 *
 * Note: reservedQuantity for Attachments should be in GIGABYTES
 * If isReservedBudget is true, the reservedQuantity is in cents
 */
export function formatReservedWithUnits(
  reservedQuantity: ReservedSku,
  dataCategory: string,
  options: FormatOptions = {
    isAbbreviated: false,
    useUnitScaling: false,
    isGifted: false,
  },
  isReservedBudget = false
): string {
  if (isReservedBudget) {
    return displayPriceWithCents({cents: reservedQuantity ?? 0});
  }
  if (dataCategory !== DataCategory.ATTACHMENTS) {
    return formatReservedNumberToString(reservedQuantity, options);
  }
  // convert reservedQuantity to BYTES to check for unlimited
  const usageGb = reservedQuantity ? reservedQuantity * GIGABYTE : reservedQuantity;
  if (isUnlimitedReserved(usageGb)) {
    return !options.isGifted ? UNLIMITED : '0 GB';
  }
  if (!options.useUnitScaling) {
    const formatted = formatReservedNumberToString(reservedQuantity, options);
    return `${formatted} GB`;
  }

  return formatAttachmentUnits(reservedQuantity || 0, 3);
}

/**
 * This expects values from CustomerUsageEndpoint, which contains usage
 * quantities for the data categories that we sell.
 *
 * Note: usageQuantity for Attachments should be in BYTES
 */
export function formatUsageWithUnits(
  usageQuantity = 0,
  dataCategory: string,
  options: FormatOptions = {isAbbreviated: false, useUnitScaling: false}
) {
  if (dataCategory === DataCategory.ATTACHMENTS) {
    if (options.useUnitScaling) {
      return formatAttachmentUnits(usageQuantity);
    }

    const usageGb = usageQuantity / GIGABYTE;
    return options.isAbbreviated
      ? `${displayNumber(usageGb)} GB`
      : `${usageGb.toLocaleString(undefined, {maximumFractionDigits: 2})} GB`;
  }
  if (dataCategory === DataCategory.PROFILE_DURATION) {
    const usageProfileHours = usageQuantity / MILLISECONDS_IN_HOUR;
    if (usageProfileHours === 0) {
      return '0';
    }
    return options.isAbbreviated
      ? displayNumber(usageProfileHours, 1)
      : usageProfileHours.toLocaleString(undefined, {maximumFractionDigits: 1});
  }
  return options.isAbbreviated
    ? displayNumber(usageQuantity, 0)
    : usageQuantity.toLocaleString();
}

/**
 * Do not export.
 * Helper method for formatReservedWithUnits
 */
function formatReservedNumberToString(
  reservedQuantity: ReservedSku,
  options: FormatOptions = {
    isAbbreviated: false,
    isGifted: false,
    useUnitScaling: false,
    fractionDigits: 0,
  }
): string {
  // "null" indicates that there's no quota for it.
  if (!defined(reservedQuantity)) {
    return '0';
  }

  if (reservedQuantity === RESERVED_BUDGET_QUOTA) {
    return 'N/A';
  }

  if (isUnlimitedReserved(reservedQuantity) && !options.isGifted) {
    return UNLIMITED;
  }

  return options.isAbbreviated
    ? displayNumber(reservedQuantity, options.fractionDigits)
    : reservedQuantity.toLocaleString(undefined, {maximumFractionDigits: 1});
}

/**
 * Do not export.
 * Use formatReservedWithUnits or formatUsageWithUnits instead.
 *
 * This function is different from sentry/utils/formatBytes. Note the
 * difference between *a-bytes (base 10) vs *i-bytes (base 2), which means that:
 * - 1000 megabytes is equal to 1 gigabyte
 * - 1024 mebibytes is equal to 1024 gibibytes
 *
 * We will use base 10 throughout billing for attachments. This function formats
 * quota/usage values for display.
 *
 * For storage/memory/file sizes, please take a look at the function in
 * sentry/utils/formatBytes.
 */
function formatAttachmentUnits(bytes: number, u = 0) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const threshold = 1000;

  while (bytes >= threshold) {
    bytes /= threshold;
    u += 1;
  }

  return bytes.toLocaleString(undefined, {maximumFractionDigits: 2}) + ' ' + units[u];
}

/**
 * Do not export.
 * Use formatReservedWithUnits or formatUsageWithUnits with options.isAbbreviated to true
 */
function displayNumber(n: number, fractionDigits = 0) {
  if (n >= BILLION) {
    return (n / BILLION).toLocaleString(undefined, {maximumFractionDigits: 2}) + 'B';
  }

  if (n >= MILLION) {
    return (n / MILLION).toLocaleString(undefined, {maximumFractionDigits: 1}) + 'M';
  }

  if (n >= 1000) {
    return (n / 1000).toFixed().toLocaleString() + 'K';
  }

  // Do not show decimals
  return n.toFixed(fractionDigits).toLocaleString();
}

/**
 * Utility functions for Pricing Plans
 */
export const isEnterprise = (subscription: Subscription) =>
  ['e1', 'enterprise'].some(p => subscription.plan.startsWith(p));

export const isTrialPlan = (plan: string) => TRIAL_PLANS.includes(plan);

export const hasPerformance = (plan?: Plan) => {
  return (
    // Older plans will have Transactions
    plan?.categories?.includes(DataCategory.TRANSACTIONS) ||
    // AM3 Onwards will have Spans
    plan?.categories?.includes(DataCategory.SPANS)
  );
};

export const hasPartnerMigrationFeature = (organization: Organization) =>
  organization.features.includes('partner-billing-migration');

export const hasActiveVCFeature = (organization: Organization) =>
  organization.features.includes('vc-marketplace-active-customer');

export const isDeveloperPlan = (plan?: Plan) => plan?.name === PlanName.DEVELOPER;

export const isBizPlanFamily = (plan?: Plan) =>
  plan?.name === PlanName.BUSINESS ||
  plan?.name === PlanName.BUSINESS_BUNDLE ||
  plan?.name === PlanName.BUSINESS_SPONSORED;

export const isTeamPlanFamily = (plan?: Plan) =>
  plan?.name === PlanName.TEAM ||
  plan?.name === PlanName.TEAM_BUNDLE ||
  plan?.name === PlanName.TEAM_SPONSORED;

export const isBusinessTrial = (subscription: Subscription) => {
  return (
    subscription.isTrial &&
    !subscription.isPerformancePlanTrial &&
    !subscription.isEnterpriseTrial
  );
};

export function isAmPlan(planId?: string) {
  return typeof planId === 'string' && planId.startsWith('am');
}

function isAm2Plan(planId?: string) {
  return typeof planId === 'string' && planId.startsWith('am2');
}

export function isAm3Plan(planId?: string) {
  return typeof planId === 'string' && planId.startsWith('am3');
}

export function isAm3DsPlan(planId?: string) {
  return typeof planId === 'string' && planId.startsWith('am3') && planId.includes('_ds');
}

export function isAmEnterprisePlan(planId?: string) {
  return (
    typeof planId === 'string' &&
    planId.startsWith('am') &&
    (planId.endsWith('_ent') ||
      planId.endsWith('_ent_auf') ||
      planId.endsWith('_ent_ds') ||
      planId.endsWith('_ent_ds_auf'))
  );
}

export function hasJustStartedPlanTrial(subscription: Subscription) {
  return subscription.isTrial && subscription.isTrialStarted;
}

export const displayPlanName = (plan?: Plan | null) => {
  return isAmEnterprisePlan(plan?.id) ? 'Enterprise' : plan?.name ?? '[unavailable]';
};

export const getAmPlanTier = (plan: string) => {
  if (isAm3Plan(plan)) {
    return PlanTier.AM3;
  }
  if (isAm2Plan(plan)) {
    return PlanTier.AM2;
  }
  if (isAmPlan(plan)) {
    return PlanTier.AM1;
  }
  return null;
};

/**
 * Promotion utility functions that are based off of formData which has the plan as a string
 * instead of a Plan
 */

export const getBusinessPlanOfTier = (plan: string) =>
  plan.startsWith('am2_') ? 'am2_business' : 'am1_business';

export const isTeamPlan = (plan: string) => plan.includes('team');

/**
 * Get the number of days left on trial
 */
export function getTrialDaysLeft(subscription: Subscription): number {
  // trial end is in the future
  return -1 * getDaysSinceDate(subscription.trialEnd ?? '');
}

/**
 * Get the number of days left on contract
 */
export function getContractDaysLeft(subscription: Subscription): number {
  // contract period end is in the future
  return -1 * getDaysSinceDate(subscription.contractPeriodEnd ?? '');
}

/**
 * Return a sorted list of plans the user can upgrade to.
 * Used to find the best plan for an org to upgrade to
 * based on a particular feature to unlock.
 */
function sortPlansForUpgrade(billingConfig: BillingConfig, subscription: Subscription) {
  // Filter plans down to just user selectable plans types of the orgs current
  // contract interval. Sorted by price as features will become progressively
  // more available.
  let plans = billingConfig.planList
    .sort((a, b) => a.price - b.price)
    .filter(p => p.userSelectable && p.billingInterval === subscription.billingInterval);

  // If we're dealing with plans that are *not part of a tier* Then we can
  // assume special case that there is only one plan.
  if (billingConfig.id === null && plans.length === 0) {
    plans = billingConfig.planList;
  }
  return plans;
}

export function getBestPlanForUnlimitedMembers(
  billingConfig: BillingConfig,
  subscription: Subscription
) {
  const plans = sortPlansForUpgrade(billingConfig, subscription);
  // the best plan is the first one that has unlimited members
  return plans.find(p => p.maxMembers === null);
}

export function getTrialLength(_organization: Organization) {
  // currently only doing trials of 14 days
  return DEFAULT_TRIAL_DAYS;
}

export function formatBalance(value: number) {
  return value < 0
    ? `${displayPriceWithCents({cents: 0 - value})} credit`
    : `${displayPriceWithCents({cents: value})} owed`;
}

export enum UsageAction {
  START_TRIAL = 'start_trial',
  ADD_EVENTS = 'add_events',
  REQUEST_ADD_EVENTS = 'request_add_events',
  REQUEST_UPGRADE = 'request_upgrade',
  SEND_TO_CHECKOUT = 'send_to_checkout',
}

/**
 * Return the best action that user can take so that organization
 * can get more events.
 */
export function getBestActionToIncreaseEventLimits(
  organization: Organization,
  subscription: Subscription
) {
  const isPaidPlan = subscription.planDetails?.price > 0;
  const hasBillingPerms = organization.access?.includes('org:billing');

  // free orgs can increase event limits by trialing
  if (!isPaidPlan && subscription.canTrial) {
    return UsageAction.START_TRIAL;
  }
  // paid plans should add events without changing plans
  if (isPaidPlan && hasPerformance(subscription.planDetails)) {
    return hasBillingPerms ? UsageAction.ADD_EVENTS : UsageAction.REQUEST_ADD_EVENTS;
  }
  // otherwise, we want them to upgrade to a different plan
  return hasBillingPerms ? UsageAction.SEND_TO_CHECKOUT : UsageAction.REQUEST_UPGRADE;
}

/**
 * Returns a name for the plan that we can display to users
 */
export function getFriendlyPlanName(subscription: Subscription) {
  const {name} = subscription.planDetails;
  switch (name) {
    case 'Trial':
      return 'Business Trial';
    default:
      return name;
  }
}

export function hasAccessToSubscriptionOverview(
  subscription: Subscription,
  organization: Organization
) {
  return organization.access.includes('org:billing') || subscription.canSelfServe;
}

/**
 * Returns the soft cap type for the given metric history category that can be
 * displayed to users if applicable. Returns null for if no soft cap type.
 */
export function getSoftCapType(metricHistory: BillingMetricHistory): string | null {
  if (metricHistory.softCapType) {
    return titleCase(metricHistory.softCapType.replace(/_/g, ' '));
  }
  if (metricHistory.trueForward) {
    return 'True Forward';
  }
  return null;
}

/**
 * Returns:
 *    active trial with latest end date, if available, else
 *    available trial with most trial days, else
 *    most recently ended trial, else
 *    null,
 *    in that order.
 */
export function getProductTrial(
  productTrials: ProductTrial[] | null,
  category: DataCategory
): ProductTrial | null {
  const trialsForCategory =
    productTrials
      ?.filter(pt => pt.category === category)
      .sort((a, b) => b.endDate?.localeCompare(a.endDate ?? '') || 0) ?? [];

  const activeProductTrial = getActiveProductTrial(trialsForCategory, category);

  if (activeProductTrial) {
    return activeProductTrial;
  }

  const longestAvailableTrial = getPotentialProductTrial(trialsForCategory, category);

  if (longestAvailableTrial) {
    return longestAvailableTrial;
  }

  return trialsForCategory[0] ?? null;
}

/**
 * Returns the currently active product trial for the specified category if there is one,
 * otherwise, returns null.
 */
export function getActiveProductTrial(
  productTrials: ProductTrial[] | null,
  category: DataCategory
): ProductTrial | null {
  if (!productTrials) {
    return null;
  }
  const currentTrials = productTrials
    .filter(
      pt =>
        pt.category === category &&
        pt.isStarted &&
        getDaysSinceDate(pt.endDate ?? '') <= 0
    )
    .sort((a, b) => b.endDate?.localeCompare(a.endDate ?? '') || 0);

  return currentTrials[0] ?? null;
}

/**
 * Returns the longest available trial for the specified category if there is one,
 * otherwise, returns null.
 */
export function getPotentialProductTrial(
  productTrials: ProductTrial[] | null,
  category: DataCategory
): ProductTrial | null {
  if (!productTrials) {
    return null;
  }
  const potentialTrials = productTrials
    .filter(
      pt =>
        pt.category === category &&
        !pt.isStarted &&
        getDaysSinceDate(pt.endDate ?? '') <= 0
    )
    .sort((a, b) => (b.lengthDays ?? 0) - (a.lengthDays ?? 0));

  return potentialTrials[0] ?? null;
}

export function trialPromptIsDismissed(prompt: PromptData, subscription: Subscription) {
  const {snoozedTime, dismissedTime} = prompt || {};
  const time = snoozedTime || dismissedTime;
  if (!time) {
    return false;
  }
  const onDemandPeriodStart = new Date(subscription.onDemandPeriodStart);
  return time >= onDemandPeriodStart.getTime() / 1000;
}

export function partnerPlanEndingModalIsDismissed(
  prompt: PromptData,
  subscription: Subscription,
  timeframe: string
) {
  const {snoozedTime, dismissedTime} = prompt || {};
  const time = snoozedTime || dismissedTime;
  if (!time) {
    return false;
  }

  const lastDaysLeft = moment(subscription.contractPeriodEnd).diff(
    moment.unix(time),
    'days'
  );

  switch (timeframe) {
    case 'zero':
      return lastDaysLeft <= 0;
    case 'two':
      return lastDaysLeft <= 2 && lastDaysLeft > 0;
    case 'week':
      return lastDaysLeft <= 7 && lastDaysLeft > 2;
    case 'month':
      return lastDaysLeft <= 30 && lastDaysLeft > 7;
    default:
      return true;
  }
}
