import upperFirst from 'lodash/upperFirst';

import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';

import type {
  BillingMetricHistory,
  Plan,
  RecurringCredit,
  Subscription,
} from 'getsentry/types';
import {CreditType} from 'getsentry/types';

export const GIFT_CATEGORIES: string[] = [
  DataCategory.ERRORS,
  DataCategory.TRANSACTIONS,
  DataCategory.REPLAYS,
  DataCategory.ATTACHMENTS,
  DataCategory.MONITOR_SEATS,
  DataCategory.SPANS,
  DataCategory.SPANS_INDEXED,
  DataCategory.PROFILE_DURATION,
  DataCategory.UPTIME,
];

const DATA_CATEGORY_FEATURES: {[key: string]: string | null} = {
  [DataCategory.ERRORS]: null, // All plans have access to errors
  [DataCategory.TRANSACTIONS]: 'performance-view',
  [DataCategory.REPLAYS]: 'session-replay',
  [DataCategory.ATTACHMENTS]: 'event-attachments',
  [DataCategory.MONITOR_SEATS]: 'monitor-seat-billing',
  [DataCategory.SPANS]: 'spans-usage-tracking',
  [DataCategory.UPTIME]: 'uptime',
};

const CREDIT_TYPE_TO_DATA_CATEGORY = {
  [CreditType.ERROR]: DataCategory.ERRORS,
  [CreditType.TRANSACTION]: DataCategory.TRANSACTIONS,
  [CreditType.SPAN]: DataCategory.SPANS,
  [CreditType.PROFILE_DURATION]: DataCategory.PROFILE_DURATION,
  [CreditType.ATTACHMENT]: DataCategory.ATTACHMENTS,
  [CreditType.REPLAY]: DataCategory.REPLAYS,
  [CreditType.MONITOR_SEAT]: DataCategory.MONITOR_SEATS,
  [CreditType.UPTIME]: DataCategory.UPTIME,
};

export const SINGULAR_DATA_CATEGORY = {
  default: 'default',
  errors: 'error',
  transactions: 'transaction',
  profiles: 'profile',
  attachments: 'attachment',
  replays: 'replay',
  monitorSeats: 'monitorSeat',
  spans: 'span',
  uptime: 'uptime',
};

/**
 *
 * Get the data category for a recurring credit type
 */
export function getCreditDataCategory(credit: RecurringCredit) {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  return CREDIT_TYPE_TO_DATA_CATEGORY[credit.type];
}

type CategoryNameProps = {
  category: string;
  capitalize?: boolean;
  hadCustomDynamicSampling?: boolean;
  plan?: Plan;
};

/**
 * Convert a billed category to a display name.
 */
export function getPlanCategoryName({
  plan,
  category,
  hadCustomDynamicSampling = false,
  capitalize = true,
}: CategoryNameProps) {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const displayNames = plan?.categoryDisplayNames?.[category];
  const categoryName =
    category === DataCategory.SPANS && hadCustomDynamicSampling
      ? 'accepted spans'
      : displayNames
        ? displayNames.plural
        : category;
  return capitalize ? upperFirst(categoryName) : categoryName;
}

/**
 * Convert a billed category to a singular display name.
 */
export function getSingularCategoryName({
  plan,
  category,
  hadCustomDynamicSampling = false,
  capitalize = true,
}: CategoryNameProps) {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const displayNames = plan?.categoryDisplayNames?.[category];
  const categoryName =
    category === DataCategory.SPANS && hadCustomDynamicSampling
      ? 'accepted span'
      : displayNames
        ? displayNames.singular
        : category.substring(0, category.length - 1);
  return capitalize ? upperFirst(categoryName) : categoryName;
}

/**
 * Get a string of display names.
 *
 * Ex: errors, transctions, and attachments.
 */
export function listDisplayNames({
  plan,
  categories,
  hadCustomDynamicSampling = false,
}: {
  categories: string[];
  plan: Plan;
  hadCustomDynamicSampling?: boolean;
}) {
  const categoryNames = categories
    .filter(
      category => category !== DataCategory.SPANS_INDEXED || hadCustomDynamicSampling // filter out stored spans if no DS
    )
    .map(category =>
      getPlanCategoryName({plan, category, capitalize: false, hadCustomDynamicSampling})
    );
  return oxfordizeArray(categoryNames);
}

/**
 * Sort data categories in order.
 */
export function sortCategories(categories?: {
  [key: string]: BillingMetricHistory;
}): BillingMetricHistory[] {
  return Object.values(categories || {}).sort((a, b) => (a.order > b.order ? 1 : -1));
}

export function sortCategoriesWithKeys(categories?: {
  [key: string]: BillingMetricHistory;
}): Array<[string, BillingMetricHistory]> {
  return Object.entries(categories || {}).sort((a, b) =>
    a[1].order > b[1].order ? 1 : -1
  );
}

/**
 * Whether the subscription plan includes a data category.
 */
function hasCategory(subscription: Subscription, category: string) {
  return hasPlanCategory(subscription.planDetails, category);
}

function hasPlanCategory(plan: Plan, category: string) {
  return plan.categories.includes(category);
}

/**
 * Whether an organization has access to a data category.
 *
 * NOTE: Includes accounts that have free access to a data category through
 * custom feature handlers and plan trial. Used for usage UI.
 */
export function hasCategoryFeature(
  category: string,
  subscription: Subscription,
  organization: Organization
) {
  if (hasCategory(subscription, category)) {
    return true;
  }

  const feature = DATA_CATEGORY_FEATURES[category];
  if (typeof feature === 'undefined') {
    return false;
  }
  return feature ? organization.features.includes(feature) : true;
}
