import upperFirst from 'lodash/upperFirst';

import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {t} from 'sentry/locale';
import {DataCategory, DataCategoryExact} from 'sentry/types/core';
import {oxfordizeArray} from 'sentry/utils/oxfordizeArray';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import {UNLIMITED_RESERVED} from 'getsentry/constants';
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
import {MILLISECONDS_IN_HOUR} from 'getsentry/utils/billing';

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
      freeEventsMultiple: 0,
      feature: null,
      hasSpikeProtection: false,
      checkoutTooltip: null,
      tallyType: 'usage',
      hasPerCategory: false,
      adminOnlyProductTrialFeature: null,
    };
  }
);

/**
 * Extension of DATA_CATEGORY_INFO with billing info for billed categories.
 * All categories with isBilledCategory: true, should be explicitly
 * added to this object with billing info.
 */
const BILLED_DATA_CATEGORY_INFO = {
  ...DEFAULT_BILLED_DATA_CATEGORY_INFO,
  [DataCategoryExact.ERROR]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.ERROR],
    canAllocate: true,
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
    freeEventsMultiple: 1,
    feature: 'session-replay',
    checkoutTooltip: t(
      'Session Replays are video-like reproductions of your users\u2019 sessions navigating your app or website.'
    ),
    hasPerCategory: true,
  },
  [DataCategoryExact.SPAN]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.SPAN],
    canProductTrial: true,
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
    freeEventsMultiple: 100_000,
    feature: 'spans-usage-tracking',
  },
  [DataCategoryExact.MONITOR_SEAT]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.MONITOR_SEAT],
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
    freeEventsMultiple: 1,
    feature: 'uptime-billing',
    tallyType: 'seat',
    hasPerCategory: true,
    checkoutTooltip: t(
      'Uptime monitoring checks your application\u2019s availability and alerts you when services go down so you can respond quickly.'
    ),
    shortenedUnitName: t('monitor'),
  },
  [DataCategoryExact.PROFILE_DURATION]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.PROFILE_DURATION],
    canProductTrial: true,
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
    freeEventsMultiple: 1,
    hasSpikeProtection: false,
    feature: 'logs-billing',
    checkoutTooltip: t(
      'A log records events from your application, giving you the context to debug issues and understand system behavior.'
    ),
    shortenedUnitName: 'GB',
  },
  [DataCategoryExact.TRACE_METRIC_BYTE]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.TRACE_METRIC_BYTE],
    canProductTrial: true,
    freeEventsMultiple: 1,
    feature: 'expose-category-trace-metric-byte',
    shortenedUnitName: 'GB',
    checkoutTooltip: t(
      'Application Metrics capture key signals from your application using counters, gauges, and distributions.'
    ),
  },
  [DataCategoryExact.SEER_USER]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.SEER_USER],
    feature: 'seer-user-billing-launch',
    canProductTrial: false,
    freeEventsMultiple: 1,
    tallyType: 'seat',
    shortenedUnitName: t('contributor'),
  },
  [DataCategoryExact.SIZE_ANALYSIS]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.SIZE_ANALYSIS],
    freeEventsMultiple: 1,
    shortenedUnitName: t('build'),
    adminOnlyProductTrialFeature: true,
  },
  [DataCategoryExact.INSTALLABLE_BUILD]: {
    ...DEFAULT_BILLED_DATA_CATEGORY_INFO[DataCategoryExact.INSTALLABLE_BUILD],
    freeEventsMultiple: 1,
    shortenedUnitName: t('install'),
    adminOnlyProductTrialFeature: 'expose-category-installable-build',
  },
} as const satisfies Record<DataCategoryExact, BilledDataCategoryInfo>;

/**
 * Returns billing-enriched data category info for all categories.
 * This wraps the static constant so it can later be replaced with a backend call.
 */
export function getBilledDataCategoryInfo(): Record<
  DataCategoryExact,
  BilledDataCategoryInfo
> {
  return BILLED_DATA_CATEGORY_INFO;
}

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
      ? t('accepted spans')
      : displayNames
        ? displayNames.plural
        : (getCategoryInfoFromPlural(category)?.titleName?.toLowerCase() ?? category);
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
      ? t('accepted span')
      : displayNames
        ? displayNames.singular
        : (getCategoryInfoFromPlural(category)?.displayName ??
          category.substring(0, category.length - 1));
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
 * Whether a category belongs to a reserved budget available on the plan (e.g.
 * Seer's seerAutofix/seerScanner). Such categories are configured through their
 * reserved budget rather than a per-category reserved-volume slider, so they are
 * excluded from the checkout volume sliders.
 */
export function isReservedBudgetCategory(category: DataCategory, plan: Plan): boolean {
  return Object.values(plan?.availableReservedBudgetTypes ?? {}).some(budgetInfo =>
    budgetInfo.dataCategories.includes(category)
  );
}

/**
 * Whether a category is reservable in checkout — i.e. it has a real reserved
 * tier (its first reserved bucket is a non-zero or unlimited amount, rather than
 * a PAYG-only 0) and isn't billed through a reserved budget. Mirrors the
 * server's is_checkout_category, and is the set shown in the admin reserved
 * volume controls. Categories whose only reserved option is 0 (e.g. continuous
 * profiling, Seer users) are excluded.
 */
export function isCheckoutCategory(category: DataCategory, plan: Plan): boolean {
  return (
    (plan.planCategories[category]?.[0]?.events ?? 0) !== 0 &&
    !isReservedBudgetCategory(category, plan)
  );
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

export function isContinuousProfiling(category: DataCategory | string) {
  return (
    category === DataCategory.PROFILE_DURATION ||
    category === DataCategory.PROFILE_DURATION_UI
  );
}

export function isByteCategory(category: DataCategory | string) {
  return (
    category === DataCategory.ATTACHMENTS ||
    category === DataCategory.LOG_BYTE ||
    category === DataCategory.TRACE_METRIC_BYTE
  );
}

/**
 * Whether the category is an emerge category (size analysis or build distribution).
 */
export function isEmergeCategory(category: DataCategory | string) {
  return (
    category === DataCategory.SIZE_ANALYSIS || category === DataCategory.INSTALLABLE_BUILD
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

function formatWithHours(
  quantityInMilliseconds: number,
  formattedHours: string,
  options: Pick<CategoryNameProps, 'title'>
) {
  const quantityInHours =
    quantityInMilliseconds === UNLIMITED_RESERVED
      ? quantityInMilliseconds
      : quantityInMilliseconds / MILLISECONDS_IN_HOUR;
  if (quantityInHours === 1) {
    return `${formattedHours} ${options.title ? t('Hour') : t('hour')}`;
  }
  return `${formattedHours} ${options.title ? t('Hours') : t('hours')}`;
}

/**
 * Format category usage or reserved quantity with the appropriate display name.
 */
export function formatCategoryQuantityWithDisplayName({
  dataCategory,
  quantity,
  formattedQuantity,
  subscription,
  planOverride,
  options,
}: {
  dataCategory: DataCategory;
  formattedQuantity: string;
  options: Omit<CategoryNameProps, 'category'>;
  quantity: number;
  subscription: Subscription;
  planOverride?: Plan;
}) {
  if (isContinuousProfiling(dataCategory)) {
    return formatWithHours(quantity, formattedQuantity, options);
  }
  const plan = planOverride ?? subscription.planDetails;
  if (quantity === 1) {
    const displayName = getSingularCategoryName({
      plan,
      category: dataCategory,
      capitalize: options.capitalize,
      title: options.title,
      hadCustomDynamicSampling: options.hadCustomDynamicSampling,
    });
    return `${formattedQuantity} ${displayName}`;
  }

  const displayName = getPlanCategoryName({
    plan,
    category: dataCategory,
    capitalize: options.capitalize,
    title: options.title,
    hadCustomDynamicSampling: options.hadCustomDynamicSampling,
  });
  return `${formattedQuantity} ${displayName}`;
}

/**
 * Calculate the accumulated variable spend for active contributors, in cents.
 */
export function calculateSeerUserSpend(metricHistory: BillingMetricHistory) {
  const {category, usage, reserved, prepaid} = metricHistory;
  if (category !== DataCategory.SEER_USER) {
    return 0;
  }
  if (reserved !== 0) {
    // if they have reserved or unlimited seats, we assume there is no variable spend
    return 0;
  }
  // TODO(seer): serialize pricing info
  return Math.max(0, usage - prepaid) * 40_00;
}
