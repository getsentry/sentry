import moment from 'moment-timezone';

import type {PromptData} from 'sentry/actionCreators/prompts';
import {IconBuilding, IconGroup, IconSeer, IconUser} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

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
import {
  AddOnCategory,
  CREDIT_INVOICE_ITEM_TYPES,
  FEE_INVOICE_ITEM_TYPES,
  OnDemandBudgetMode,
  PlanName,
  PlanTier,
  ReservedBudgetCategoryType,
} from 'getsentry/types';
import type {
  BillingConfig,
  BillingDetails,
  BillingMetricHistory,
  BillingStatTotal,
  EventBucket,
  InvoiceItem,
  Plan,
  PreviewInvoiceItem,
  ProductTrial,
  Subscription,
} from 'getsentry/types';
import {getCategoryInfoFromPlural} from 'getsentry/utils/dataCategory';
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

export function addBillingStatTotals(
  a: BillingStatTotal,
  b: BillingStatTotal[]
): BillingStatTotal {
  return b.reduce(
    (acc, curr) => ({
      accepted: acc.accepted + (curr?.accepted ?? 0),
      dropped: acc.dropped + (curr?.dropped ?? 0),
      droppedOther: acc.droppedOther + (curr?.droppedOther ?? 0),
      droppedOverQuota: acc.droppedOverQuota + (curr?.droppedOverQuota ?? 0),
      droppedSpikeProtection:
        acc.droppedSpikeProtection + (curr?.droppedSpikeProtection ?? 0),
      filtered: acc.filtered + (curr?.filtered ?? 0),
      projected: acc.projected + (curr?.projected ?? 0),
    }),
    a
  );
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
  reservedQuantity: number | null,
  dataCategory: DataCategory,
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

  const categoryInfo = getCategoryInfoFromPlural(dataCategory);
  const unitType = categoryInfo?.formatting.unitType ?? 'count';

  if (unitType !== 'bytes') {
    return formatReservedNumberToString(reservedQuantity, options);
  }

  // convert reservedQuantity to BYTES to check for unlimited
  // unless it's already unlimited
  const usageGb =
    reservedQuantity && !isUnlimitedReserved(reservedQuantity)
      ? reservedQuantity * GIGABYTE
      : reservedQuantity;
  if (isUnlimitedReserved(usageGb)) {
    return options.isGifted ? '0 GB' : UNLIMITED;
  }

  if (!options.useUnitScaling) {
    const byteOptions =
      dataCategory === DataCategory.LOG_BYTE
        ? {...options, isAbbreviated: false}
        : options;
    const formatted = formatReservedNumberToString(reservedQuantity, byteOptions);
    return `${formatted} GB`;
  }

  return formatByteUnits(reservedQuantity || 0, 3);
}

/**
 * This expects values from CustomerUsageEndpoint, which contains usage
 * quantities for the data categories that we sell.
 *
 * Note: usageQuantity for Attachments and Logs should be in BYTES
 */
export function formatUsageWithUnits(
  usageQuantity = 0,
  dataCategory: DataCategory,
  options: FormatOptions = {isAbbreviated: false, useUnitScaling: false}
) {
  const categoryInfo = getCategoryInfoFromPlural(dataCategory);
  const unitType = categoryInfo?.formatting.unitType ?? 'count';

  if (unitType === 'bytes') {
    if (options.useUnitScaling) {
      return formatByteUnits(usageQuantity);
    }

    const usageGb = usageQuantity / GIGABYTE;
    return options.isAbbreviated
      ? `${displayNumber(usageGb)} GB`
      : `${usageGb.toLocaleString(undefined, {maximumFractionDigits: 2})} GB`;
  }
  if (unitType === 'durationHours') {
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

export function convertUsageToReservedUnit(
  usage: number,
  category: DataCategory | string
): number {
  const categoryInfo = getCategoryInfoFromPlural(category as DataCategory);
  const unitType = categoryInfo?.formatting.unitType ?? 'count';

  if (unitType === 'bytes') {
    return usage / GIGABYTE;
  }
  if (unitType === 'durationHours') {
    return usage / MILLISECONDS_IN_HOUR;
  }
  return usage;
}

/**
 * Do not export.
 * Helper method for formatReservedWithUnits
 */
function formatReservedNumberToString(
  reservedQuantity: number | null,
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
function formatByteUnits(bytes: number, u = 0) {
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
export const isEnterprise = (plan: string) =>
  ['e1', 'enterprise'].some(p => plan.startsWith(p)) || isAmEnterprisePlan(plan);

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

// TODO(isabella): clean this up after GA
export const hasNewBillingUI = (organization: Organization) =>
  organization.features.includes('subscriptions-v3');

// TODO(isabella): clean this up after GA
export const hasStripeComponentsFeature = (organization: Organization) =>
  organization.features.includes('stripe-components');

export const isDeveloperPlan = (plan?: Plan) => plan?.name === PlanName.DEVELOPER;

export const isBizPlanFamily = (plan?: Plan) => plan?.name.includes(PlanName.BUSINESS);

export const isTeamPlanFamily = (plan?: Plan) => plan?.name.includes(PlanName.TEAM);

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

export function isAm2Plan(planId?: string) {
  return typeof planId === 'string' && planId.startsWith('am2');
}

export function isAm3Plan(planId?: string) {
  return typeof planId === 'string' && planId.startsWith('am3');
}

export function isAm3DsPlan(planId?: string) {
  return typeof planId === 'string' && planId.startsWith('am3') && planId.includes('_ds');
}

export function isAmEnterprisePlan(planId?: string) {
  if (typeof planId !== 'string' || !isAmPlan(planId)) {
    return false;
  }

  return planId.includes('_ent');
}

export function hasJustStartedPlanTrial(subscription: Subscription) {
  return subscription.isTrial && subscription.isTrialStarted;
}

export const displayBudgetName = (
  plan?: Plan | null,
  options: {
    abbreviated?: boolean;
    pluralOndemand?: boolean;
    title?: boolean;
    withBudget?: boolean;
  } = {}
) => {
  const budgetTerm = plan?.budgetTerm ?? 'pay-as-you-go';
  const text = `${budgetTerm}${options.withBudget ? ' budget' : ''}`;
  if (options.abbreviated) {
    if (budgetTerm === 'pay-as-you-go') {
      return 'PAYG';
    }
    return 'OD';
  }
  if (options.title) {
    if (budgetTerm === 'on-demand') {
      if (options.withBudget) {
        if (options.pluralOndemand) {
          return 'On-Demand Budgets';
        }
        return 'On-Demand Budget';
      }
      return 'On-Demand';
    }
    return titleCase(text);
  }
  return text;
};

/**
 * Returns the configurable on-demand/PAYG categories for the given plan
 * and budget mode.
 *
 * @param plan - The plan to get the on-demand/PAYG categories for
 * @param budgetMode - The on-demand/PAYG budget mode
 * @returns A list of the appropriate on-demand/PAYG categories for the given plan and budget mode
 */
export const getOnDemandCategories = ({
  plan,
  budgetMode,
}: {
  budgetMode: OnDemandBudgetMode | null;
  plan: Plan;
}) => {
  if (budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
    return plan.onDemandCategories.filter(category => {
      const categoryInfo = getCategoryInfoFromPlural(category);
      if (!categoryInfo) {
        return false;
      }
      return categoryInfo.hasPerCategory;
    });
  }

  return plan.onDemandCategories;
};

export const displayPlanName = (plan?: Plan | null) => {
  return isAmEnterprisePlan(plan?.id) ? 'Enterprise' : (plan?.name ?? '[unavailable]');
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

export const isNewPayingCustomer = (
  subscription: Subscription,
  organization: Organization
) =>
  subscription.isFree ||
  isTrialPlan(subscription.plan) ||
  hasPartnerMigrationFeature(organization);

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
  const hasAnyUsageExceeded = Object.values(subscription.categories).some(
    category => category.usageExceeded
  );
  if (isPaidPlan && hasPerformance(subscription.planDetails) && hasAnyUsageExceeded) {
    return hasBillingPerms ? UsageAction.ADD_EVENTS : UsageAction.REQUEST_ADD_EVENTS;
  }
  // otherwise, we want them to upgrade to a different plan if they're not already on a Business plan
  if (!isBizPlanFamily(subscription.planDetails)) {
    return hasBillingPerms ? UsageAction.SEND_TO_CHECKOUT : UsageAction.REQUEST_UPGRADE;
  }
  return '';
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

export function getPlanIcon(plan: Plan) {
  if (isBizPlanFamily(plan)) {
    return <IconBuilding />;
  }

  if (isTeamPlanFamily(plan)) {
    return <IconGroup />;
  }

  return <IconUser />;
}

export function getProductIcon(product: AddOnCategory, size?: SVGIconProps['size']) {
  if ([AddOnCategory.LEGACY_SEER, AddOnCategory.SEER].includes(product)) {
    return <IconSeer size={size} />;
  }
  return null;
}

/**
 * Returns true if the subscription can use pay-as-you-go.
 */
export function supportsPayg(subscription: Subscription) {
  return subscription.planDetails.allowOnDemand && subscription.supportsOnDemand;
}

/**
 * Whether the category can use PAYG on the subscription given existing budgets.
 * Does not check if there is PAYG left.
 */
export function hasPaygBudgetForCategory(
  subscription: Subscription,
  category: DataCategory
) {
  if (!subscription.onDemandBudgets) {
    return false;
  }
  if (subscription.onDemandBudgets.budgetMode === OnDemandBudgetMode.PER_CATEGORY) {
    return (subscription.onDemandBudgets.budgets?.[category] ?? 0) > 0;
  }
  return subscription.onDemandBudgets.sharedMaxBudget > 0;
}

/**
 * Returns true if the current user has billing perms.
 */
export function hasBillingAccess(organization: Organization) {
  return organization.access.includes('org:billing');
}

export function hasAccessToSubscriptionOverview(
  subscription: Subscription | null,
  organization: Organization
): boolean {
  return hasBillingAccess(organization) || Boolean(subscription?.canSelfServe);
}

/**
 * Returns the soft cap type for the given metric history category that can be
 * displayed to users if applicable. Returns null for if no soft cap type.
 */
export function getSoftCapType(metricHistory: BillingMetricHistory): string | null {
  if (metricHistory.softCapType) {
    return toTitleCase(metricHistory.softCapType.replace(/_/g, ' ').toLowerCase(), {
      allowInnerUpperCase: true,
    }).replace(' ', metricHistory.softCapType === 'ON_DEMAND' ? '-' : ' ');
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

/**
 * Gets the appropriate Seer data category for product trials.
 * Uses SEER_USER for seat-based billing, falls back to SEER_AUTOFIX for legacy.
 *
 * Priority order:
 * 1. SEER_USER (seat-based billing)
 * 2. SEER_AUTOFIX (legacy billing)
 */
export function getSeerTrialCategory(
  productTrials: ProductTrial[] | null
): DataCategory | null {
  if (!productTrials) {
    return null;
  }

  // Check for SEER_USER trial first (seat-based billing takes precedence)
  // For unstarted trials, endDate is the "start by" deadline
  // For started trials, endDate is the expiration date
  // In both cases, endDate must not have passed
  const seerUserTrial = productTrials.find(
    pt =>
      pt.category === DataCategory.SEER_USER && getDaysSinceDate(pt.endDate ?? '') <= 0
  );
  if (seerUserTrial) {
    return DataCategory.SEER_USER;
  }

  // Fall back to SEER_AUTOFIX (legacy)
  const seerAutofixTrial = productTrials.find(
    pt =>
      pt.category === DataCategory.SEER_AUTOFIX && getDaysSinceDate(pt.endDate ?? '') <= 0
  );
  if (seerAutofixTrial) {
    return DataCategory.SEER_AUTOFIX;
  }

  return null;
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

export function getPercentage(quantity: number, total: number | null) {
  if (typeof total === 'number' && total > 0) {
    return (Math.min(quantity, total) / total) * 100;
  }
  return 0;
}

export function displayPercentage(quantity: number, total: number | null) {
  const percentage = getPercentage(quantity, total);
  return percentage.toFixed(0) + '%';
}

/**
 * Returns true if some billing details are set.
 */
export function hasSomeBillingDetails(billingDetails: BillingDetails | undefined) {
  if (!billingDetails) {
    return false;
  }
  return (
    billingDetails &&
    Object.entries(billingDetails)
      .filter(
        ([key, _]) =>
          key !== 'billingEmail' && key !== 'companyName' && key !== 'taxNumber'
      )
      .some(([_, value]) => defined(value))
  );
}

export function getReservedBudgetCategoryForAddOn(addOnCategory: AddOnCategory) {
  if (addOnCategory === AddOnCategory.LEGACY_SEER) {
    return ReservedBudgetCategoryType.SEER;
  }
  return null;
}

// There are the data categories whose retention settings
// are exposed in Relay and can be set in _admin
export const RETENTION_SETTINGS_CATEGORIES = new Set([
  DataCategory.SPANS,
  DataCategory.LOG_BYTE,
  DataCategory.TRANSACTIONS,
]);

export function getCredits({
  invoiceItems,
}: {
  invoiceItems: InvoiceItem[] | PreviewInvoiceItem[];
}) {
  return invoiceItems.filter(
    item =>
      CREDIT_INVOICE_ITEM_TYPES.includes(item.type as any) ||
      (item.type === 'balance_change' && item.amount < 0)
  );
}

/**
 * Returns the credit applied to an invoice or preview data.
 * If the invoice items contain a BALANCE_CHANGE item with a negative amount,
 * the invoice/preview data already accounts for the credit applied, so we return 0.
 */
export function getCreditApplied({
  creditApplied,
  invoiceItems,
}: {
  creditApplied: number;
  invoiceItems: InvoiceItem[] | PreviewInvoiceItem[];
}) {
  const credits = getCredits({invoiceItems});
  if (credits.some(item => item.type === 'balance_change')) {
    return 0;
  }
  return creditApplied;
}

/**
 * Returns extra fees included in the invoice or preview data, such as tax
 * or cancellation fees.
 */
export function getFees({
  invoiceItems,
}: {
  invoiceItems: InvoiceItem[] | PreviewInvoiceItem[];
}) {
  return invoiceItems.filter(
    item =>
      FEE_INVOICE_ITEM_TYPES.includes(item.type as any) ||
      (item.type === 'balance_change' && item.amount > 0)
  );
}

/**
 * Returns ondemand invoice items from the invoice or preview data.
 */
export function getOnDemandItems({
  invoiceItems,
}: {
  invoiceItems: InvoiceItem[] | PreviewInvoiceItem[];
}) {
  return invoiceItems.filter(item => item.type.startsWith('ondemand'));
}

/**
 * Removes the budget term (pay-as-you-go/on-demand) from an ondemand item description.
 */
export function formatOnDemandDescription(
  description: string,
  plan?: Plan | null
): string {
  const budgetTerm = displayBudgetName(plan, {title: false}).toLowerCase();
  return description.replace(new RegExp(`\\s*${budgetTerm}\\s*`, 'gi'), ' ').trim();
}

/**
 * Given a DataCategory or AddOnCategory, returns true if it is an add-on, false otherwise.
 */
export function checkIsAddOn(
  selectedProduct: DataCategory | AddOnCategory | string
): boolean {
  return Object.values(AddOnCategory).includes(selectedProduct as AddOnCategory);
}

/**
 * Check if a data category is a child category of an add-on.
 * If `checkReserved` is true, we check if the data category is a child of an add-on
 * for this particular subscription.
 */
export function checkIsAddOnChildCategory(
  subscription: Subscription,
  category: DataCategory,
  checkReserved: boolean
) {
  const parentAddOn = getParentAddOn(subscription, category, checkReserved);
  return !!parentAddOn;
}

/**
 * Get the parent add-on for a data category, if any.
 *
 * When `checkReserved` is true and a potential parent is found, we check if the data category
 * has any sibling categories also tallied for billing. If so, we need to check if the data category
 * should be treated as part of the add-on (reserved budget or zero prepaid) or as a separate
 * product (any other prepaid volume).
 *
 * If the data category has no sibling categories, `checkReserved` is ignored and we return the parent add-on.
 */
export function getParentAddOn(
  subscription: Subscription | null,
  category: DataCategory,
  checkReserved: boolean
): AddOnCategory | null {
  if (!subscription) {
    return null;
  }
  const parentAddOn = Object.values(subscription.addOns ?? {})
    .filter(addOn => addOn.isAvailable)
    .find(addOn => addOn.dataCategories.includes(category));

  if (!parentAddOn) {
    return null;
  }

  const hasMultipleTalliedCategories = parentAddOn.dataCategories.length > 1;
  if (hasMultipleTalliedCategories && checkReserved) {
    const metricHistory = subscription.categories[category];
    if (!metricHistory) {
      return null;
    }
    if (![RESERVED_BUDGET_QUOTA, 0].includes(metricHistory.reserved ?? 0)) {
      return null;
    }
  }

  return parentAddOn.apiName;
}

/**
 * Get the billed DataCategory for an add-on or DataCategory.
 */
export function getBilledCategory(
  subscription: Subscription,
  selectedProduct: DataCategory | AddOnCategory
): DataCategory | null {
  if (checkIsAddOn(selectedProduct)) {
    const category = selectedProduct as AddOnCategory;
    const addOnInfo = subscription.addOns?.[category];
    if (!addOnInfo) {
      return null;
    }

    const {dataCategories, apiName} = addOnInfo;
    const reservedBudgetCategory = getReservedBudgetCategoryForAddOn(apiName);
    const reservedBudget = subscription.reservedBudgets?.find(
      budget => budget.apiName === reservedBudgetCategory
    );
    return reservedBudget
      ? (dataCategories.find(dataCategory =>
          subscription.planDetails.planCategories[dataCategory]?.find(
            bucket => bucket.events === RESERVED_BUDGET_QUOTA
          )
        ) ?? dataCategories[0]!)
      : dataCategories[0]!;
  }

  return selectedProduct as DataCategory;
}

export function productIsEnabled(
  subscription: Subscription,
  selectedProduct: DataCategory | AddOnCategory
): boolean {
  const billedCategory = getBilledCategory(subscription, selectedProduct);
  if (!billedCategory) {
    return false;
  }

  const activeProductTrial = getActiveProductTrial(
    subscription.productTrials ?? null,
    billedCategory
  );
  if (activeProductTrial) {
    return true;
  }

  if (checkIsAddOn(selectedProduct)) {
    const addOnInfo = subscription.addOns?.[selectedProduct as AddOnCategory];
    if (!addOnInfo) {
      return false;
    }
    return addOnInfo.enabled;
  }

  const metricHistory = subscription.categories[billedCategory];
  if (!metricHistory) {
    return false;
  }
  const isPaygOnly = metricHistory.reserved === 0;
  return (
    !isPaygOnly ||
    metricHistory.onDemandBudget > 0 ||
    (subscription.onDemandBudgets?.budgetMode === OnDemandBudgetMode.SHARED &&
      subscription.onDemandBudgets.sharedMaxBudget > 0)
  );
}

/**
 * Given a data category and potential metric history, returns a normalized metric history object.
 *
 * If the metric history is null or undefined, we return a default metric history object with all
 * fields set to 0, null, or false.
 */
export function normalizeMetricHistory(
  category: DataCategory,
  metricHistory: BillingMetricHistory | null | undefined
): BillingMetricHistory {
  return (
    metricHistory ?? {
      category,
      reserved: 0,
      usage: 0,
      prepaid: 0,
      free: 0,
      onDemandSpendUsed: 0,
      onDemandBudget: 0,
      onDemandQuantity: 0,
      customPrice: null,
      order: 0,
      paygCpe: null,
      sentUsageWarning: false,
      softCapType: null,
      trueForward: false,
      usageExceeded: false,
    }
  );
}
