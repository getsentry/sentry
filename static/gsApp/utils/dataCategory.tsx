import upperFirst from 'lodash/upperFirst';

import {DATA_CATEGORY_INFO} from 'sentry/constants';
import type {DataCategoryExact} from 'sentry/types/core';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import type {
  BillingMetricHistory,
  Plan,
  RecurringCredit,
  Subscription,
} from 'getsentry/types';
import {getCategoryInfoFromPlural} from 'getsentry/utils/billing';

/**
 *
 * Get the data category for a recurring credit type
 */
export function getCreditDataCategory(credit: RecurringCredit): DataCategory | null {
  const category =
    (DATA_CATEGORY_INFO[credit.type as string as DataCategoryExact]
      ?.plural as DataCategory) || null;
  if (!category) {
    return null;
  }
  return category;
}

type CategoryNameProps = {
  category: string;
  capitalize?: boolean;
  hadCustomDynamicSampling?: boolean;
  plan?: Plan;
  title?: boolean;
};

/**
 * Convert a billed category to a display name.
 */
export function getPlanCategoryName({
  plan,
  category,
  hadCustomDynamicSampling = false,
  capitalize = true,
  title = false,
}: CategoryNameProps) {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const displayNames = plan?.categoryDisplayNames?.[category];
  const categoryName =
    category === DataCategory.SPANS && hadCustomDynamicSampling
      ? 'accepted spans'
      : displayNames
        ? displayNames.plural
        : category;
  return title
    ? toTitleCase(categoryName, {allowInnerUpperCase: true})
    : capitalize
      ? upperFirst(categoryName)
      : categoryName;
}

/**
 * Convert a billed category to a singular display name.
 */
export function getSingularCategoryName({
  plan,
  category,
  hadCustomDynamicSampling = false,
  capitalize = true,
  title = false,
}: CategoryNameProps) {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const displayNames = plan?.categoryDisplayNames?.[category];
  const categoryName =
    category === DataCategory.SPANS && hadCustomDynamicSampling
      ? 'accepted span'
      : displayNames
        ? displayNames.singular
        : category.substring(0, category.length - 1);
  return title
    ? toTitleCase(categoryName, {allowInnerUpperCase: true})
    : capitalize
      ? upperFirst(categoryName)
      : categoryName;
}

/**
 * Convert a list of reserved budget categories to a display name for the budget
 */
export function getReservedBudgetDisplayName({
  plan,
  categories,
  hadCustomDynamicSampling = false,
  shouldTitleCase = false,
}: Omit<CategoryNameProps, 'category' | 'capitalize'> & {
  categories: string[];
  shouldTitleCase?: boolean;
}) {
  return oxfordizeArray(
    categories
      .map(category => {
        const name = getPlanCategoryName({
          plan,
          category,
          hadCustomDynamicSampling,
          capitalize: false,
        });
        return shouldTitleCase ? toTitleCase(name, {allowInnerUpperCase: true}) : name;
      })
      .sort((a, b) => {
        return a.localeCompare(b);
      })
  );
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
export function sortCategories(
  categories?: Record<string, BillingMetricHistory>
): BillingMetricHistory[] {
  return Object.values(categories || {}).sort((a, b) => (a.order > b.order ? 1 : -1));
}

export function sortCategoriesWithKeys(
  categories?: Record<string, BillingMetricHistory>
): Array<[string, BillingMetricHistory]> {
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

  const feature = getCategoryInfoFromPlural(category as DataCategory)?.feature;
  if (!feature) {
    return false;
  }
  return feature ? organization.features.includes(feature) : true;
}

export function isContinuousProfiling(category: DataCategory | string) {
  return (
    category === DataCategory.PROFILE_DURATION ||
    category === DataCategory.PROFILE_DURATION_UI
  );
}

export function getChunkCategoryFromDuration(category: DataCategory) {
  if (category === DataCategory.PROFILE_DURATION) {
    return DataCategory.PROFILE_CHUNKS;
  }
  if (category === DataCategory.PROFILE_DURATION_UI) {
    return DataCategory.PROFILE_CHUNKS_UI;
  }
  return '';
}
