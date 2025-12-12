import {useMemo} from 'react';

import type {Field} from 'sentry/components/forms/types';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {DataCategory} from 'sentry/types/core';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {
  ALWAYS_VISIBLE_FIELDS,
  NOTIFICATION_FIELD_TO_CATEGORY_MAP,
  subscriptionHasCategory,
} from 'getsentry/utils/notificationCategoryMapping';

/**
 * Hook to filter notification category fields based on subscription plan categories.
 *
 * This hook replaces the feature-flag-based filterCategoryFields function with a
 * subscription-based approach. It checks which DataCategories are available across
 * all of a user's organization subscriptions and filters notification fields accordingly.
 *
 * @param fields - Array of notification fields to filter
 * @returns Filtered array of fields based on subscription categories
 *
 * @example
 * const filteredFields = useFilterCategoryFields(SPEND_FIELDS);
 *
 * Edge cases handled:
 * - Multi-org: Shows field if ANY org has the category (logical OR)
 * - Transactions: Excludes if ALL orgs are AM3 (have spans but not transactions)
 * - Seer: Groups SEER_AUTOFIX and SEER_SCANNER (shows if either present)
 * - No subscription data: Shows all fields (permissive fallback)
 * - Always-visible fields: Never filtered (quota, quotaWarnings, quotaSpendAllocations)
 */
export function useFilterCategoryFields(fields: Field[]): Field[] {
  const {organizations} = useLegacyStore(OrganizationsStore);
  const subscriptions = useLegacyStore(SubscriptionStore);

  return useMemo(() => {
    // If no organizations, return all fields (permissive fallback)
    if (!organizations || organizations.length === 0) {
      return fields;
    }

    // Collect categories available per organization
    const categoriesPerOrg = new Map<string, Set<DataCategory>>();
    let hasAnySubscriptionData = false;

    organizations.forEach(org => {
      const subscription = subscriptions[org.slug];
      if (subscription?.planDetails?.categories) {
        hasAnySubscriptionData = true;
        categoriesPerOrg.set(org.slug, new Set(subscription.planDetails.categories));
      }
    });

    // If no subscription data available, show all fields (permissive fallback)
    if (!hasAnySubscriptionData) {
      return fields;
    }

    // Build union of all available categories across all orgs
    const allAvailableCategories = new Set<DataCategory>();
    categoriesPerOrg.forEach(orgCategories => {
      orgCategories.forEach(category => allAvailableCategories.add(category));
    });

    // Special logic for transactions: exclude if ALL orgs have spans but NO orgs have transactions
    // This handles the AM1/AM2 → AM3 migration where transactions were replaced by spans
    const hasAnyOrgWithTransactions = Array.from(categoriesPerOrg.values()).some(
      orgCategories =>
        orgCategories.has(DataCategory.TRANSACTIONS) ||
        orgCategories.has(DataCategory.TRANSACTIONS_INDEXED)
    );
    const hasAnyOrgWithSpans = Array.from(categoriesPerOrg.values()).some(orgCategories =>
      orgCategories.has(DataCategory.SPANS_INDEXED)
    );
    const excludeTransactions = hasAnyOrgWithSpans && !hasAnyOrgWithTransactions;

    // Filter fields based on category availability
    return fields.filter(field => {
      // Always show certain fields regardless of subscription
      if (ALWAYS_VISIBLE_FIELDS.has(field.name)) {
        return true;
      }

      // Special handling for transactions (AM1/AM2 vs AM3)
      if (
        field.name === 'quotaTransactions' ||
        field.name === 'quotaTransactionsIndexed' ||
        field.name === 'quotaTransactionsProcessed'
      ) {
        // Show transactions only if some org has them AND not all orgs are AM3
        return hasAnyOrgWithTransactions && !excludeTransactions;
      }

      // Check if field has a category mapping
      const category = NOTIFICATION_FIELD_TO_CATEGORY_MAP[field.name];
      if (!category) {
        // Field not in mapping - show by default (unknown field)
        return true;
      }

      // Check if any subscription has this category
      // Uses special handling for Seer grouped categories
      return subscriptionHasCategory(allAvailableCategories, category);
    });
  }, [fields, organizations, subscriptions]);
}
