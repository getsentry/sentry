import upperFirst from 'lodash/upperFirst';

import {DATA_CATEGORY_INFO} from 'sentry/constants';
import type {DataCategoryExact} from 'sentry/types/core';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import oxfordizeArray from 'sentry/utils/oxfordizeArray';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {BILLED_DATA_CATEGORY_INFO} from 'getsentry/constants';
import type {
  BilledDataCategoryInfo,
  BillingMetricHistory,
  PendingReservedBudget,
  Plan,
  RecurringCredit,
  ReservedBudget,
  ReservedBudgetCategory,
  Subscription,
} from 'getsentry/types';

/**
 * Returns the data category info defined in DATA_CATEGORY_INFO for the given category,
 * with billing context defined in BILLED_DATA_CATEGORY_INFO.
 *
 * Returns null for categories not defined in DATA_CATEGORY_INFO.
 */
export function getCategoryInfoFromPlural(
  category: DataCategory
): BilledDataCategoryInfo | null {
  const info = Object.values(BILLED_DATA_CATEGORY_INFO).find(c => c.plural === category);
  if (!info) {
    return null;
  }
  return info;
}

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
  category: DataCategory;
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
 * Get the ReservedBudgetCategory from a list of categories and a plan,
 * if it exists.
 */
export function getReservedBudgetCategoryFromCategories(
  plan: Plan,
  categories: DataCategory[]
): ReservedBudgetCategory | null {
  return (
    Object.values(plan?.availableReservedBudgetTypes ?? {}).find(
      budgetInfo =>
        categories.length === budgetInfo.dataCategories.length &&
        categories.every(category => budgetInfo.dataCategories.includes(category))
    ) ?? null
  );
}

/**
 * Whether a category is part of a reserved budget.
 * This will also return true for categories that can
 * only be bought as part of a reserved budget (ie. Seer
 * categories without having bought Seer).
 */
export function isPartOfReservedBudget(
  category: DataCategory,
  reservedBudgets: ReservedBudget[]
): boolean {
  return reservedBudgets.some(budget => budget.dataCategories.includes(category));
}

/**
 * Convert a list of reserved budget categories to a display name for the budget
 */
export function getReservedBudgetDisplayName({
  plan,
  hadCustomDynamicSampling,
  reservedBudget = null,
  pendingReservedBudget = null,
  shouldTitleCase = false,
  capitalize = false,
}: Omit<CategoryNameProps, 'category'> & {
  pendingReservedBudget?: PendingReservedBudget | null;
  reservedBudget?: ReservedBudget | null;
  shouldTitleCase?: boolean;
}) {
  const categoryList =
    reservedBudget?.dataCategories ??
    (Object.keys(pendingReservedBudget?.categories ?? {}) as DataCategory[]);
  const name =
    reservedBudget?.name ??
    (plan ? getReservedBudgetCategoryFromCategories(plan, categoryList)?.name : '');

  if (name) {
    return shouldTitleCase
      ? toTitleCase(name, {allowInnerUpperCase: true})
      : capitalize
        ? upperFirst(name)
        : name;
  }

  const formattedCategories = categoryList
    .map(category => {
      const categoryName = getPlanCategoryName({
        plan,
        category,
        hadCustomDynamicSampling,
        capitalize: false,
      });
      return shouldTitleCase
        ? toTitleCase(categoryName, {allowInnerUpperCase: true})
        : categoryName;
    })
    .sort((a, b) => {
      return a.localeCompare(b);
    });

  if (capitalize) {
    formattedCategories[0] = upperFirst(formattedCategories[0]);
  }

  return oxfordizeArray(formattedCategories) + (shouldTitleCase ? ' Budget' : ' budget');
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
  shouldTitleCase = false,
}: {
  categories: DataCategory[];
  plan: Plan;
  hadCustomDynamicSampling?: boolean;
  shouldTitleCase?: boolean;
}) {
  const categoryNames = categories
    .filter(
      category => category !== DataCategory.SPANS_INDEXED || hadCustomDynamicSampling
    )
    .map(category =>
      getPlanCategoryName({
        plan,
        category,
        capitalize: false,
        hadCustomDynamicSampling,
        title: shouldTitleCase,
      })
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
function hasCategory(subscription: Subscription, category: DataCategory) {
  return hasPlanCategory(subscription.planDetails, category);
}

function hasPlanCategory(plan: Plan, category: DataCategory) {
  return plan.categories.includes(category);
}

/**
 * Whether an organization has access to a data category.
 *
 * NOTE: Includes accounts that have free access to a data category through
 * custom feature handlers and plan trial. Used for usage UI.
 */
export function hasCategoryFeature(
  category: DataCategory,
  subscription: Subscription,
  organization: Organization
) {
  if (hasCategory(subscription, category)) {
    return true;
  }

  const feature = getCategoryInfoFromPlural(category)?.feature;
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

export function isSeer(category: DataCategory): boolean {
  return category === DataCategory.SEER_AUTOFIX || category === DataCategory.SEER_SCANNER;
}
