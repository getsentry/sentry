/**
 * Mapping between notification field names and their corresponding DataCategory.
 *
 * This mapping is used to determine which notification settings should be shown
 * based on the categories available in a user's subscription plan.
 *
 * Each entry maps a notification field name (as defined in QUOTA_FIELDS and SPEND_FIELDS)
 * to the DataCategory that must be available on the subscription for that notification
 * to be shown.
 */

import {DataCategory} from 'sentry/types/core';

/**
 * Maps notification field names to DataCategory enum values.
 *
 * Field names are from:
 * - static/app/views/settings/account/notifications/fields2.tsx (QUOTA_FIELDS, SPEND_FIELDS)
 *
 * DataCategory values are from:
 * - static/app/types/core.tsx (DataCategory enum)
 * - Backend: relay-base-schema/src/data_category.rs
 */
export const NOTIFICATION_FIELD_TO_CATEGORY_MAP: Record<string, DataCategory> = {
  // Error-related notifications
  quotaErrors: DataCategory.ERRORS,

  // Transaction-related notifications (AM1/AM2 plans)
  quotaTransactions: DataCategory.TRANSACTIONS,
  quotaTransactionsProcessed: DataCategory.TRANSACTIONS_PROCESSED,
  quotaTransactionsIndexed: DataCategory.TRANSACTIONS_INDEXED,

  // Span-related notifications (AM3 plans)
  quotaSpans: DataCategory.SPANS_INDEXED,
  quotaSpansIndexed: DataCategory.SPANS_INDEXED,

  // Attachment notifications
  quotaAttachments: DataCategory.ATTACHMENTS,

  // Replay notifications
  quotaReplays: DataCategory.REPLAYS,

  // Profile-related notifications
  quotaProfiles: DataCategory.PROFILES,
  quotaProfilesIndexed: DataCategory.PROFILES_INDEXED,

  // Continuous Profiling (Profile Duration)
  quotaProfileDuration: DataCategory.PROFILE_DURATION,
  quotaProfileDurationUI: DataCategory.PROFILE_DURATION_UI,

  // Cron monitoring notifications
  quotaMonitors: DataCategory.MONITOR,
  quotaMonitorSeats: DataCategory.MONITOR_SEATS,

  // Uptime monitoring
  quotaUptime: DataCategory.UPTIME,

  // Logging notifications
  quotaLogItems: DataCategory.LOG_ITEM,
  quotaLogBytes: DataCategory.LOG_BYTE,

  // Seer (AI/ML) notifications
  // Note: Both Autofix and Scanner are grouped under a single budget
  quotaSeerBudget: DataCategory.SEER_AUTOFIX, // Combined Seer notifications
  quotaSeerAutofix: DataCategory.SEER_AUTOFIX,
  quotaSeerScanner: DataCategory.SEER_SCANNER,

  // Prevent (Seer User) notifications
  quotaPreventUsers: DataCategory.PREVENT_USER,
  quotaPreventReviews: DataCategory.PREVENT_REVIEW,

  // User Feedback notifications
  quotaFeedback: DataCategory.USER_REPORT_V2,
};

/**
 * Categories that should always be shown regardless of subscription.
 * These are typically legacy or universal notification types.
 */
export const ALWAYS_VISIBLE_FIELDS = new Set([
  'quota', // Top-level quota notification toggle
  'quotaWarnings', // Set Quota Limit option
  'quotaSpendAllocations', // Spend Allocations (Business plan only)
]);

/**
 * Special handling for Seer categories.
 * Both SEER_AUTOFIX and SEER_SCANNER are grouped under a single budget notification.
 */
export const SEER_CATEGORY_GROUP = new Set([
  DataCategory.SEER_AUTOFIX,
  DataCategory.SEER_SCANNER,
]);

/**
 * Helper to check if a subscription has a specific category available.
 * Handles special cases like Seer grouped categories.
 */
export function subscriptionHasCategory(
  availableCategories: Set<DataCategory>,
  category: DataCategory
): boolean {
  // Direct category check
  if (availableCategories.has(category)) {
    return true;
  }

  // Special handling for Seer: if checking for Autofix or Scanner,
  // either one being present means the Seer budget is available
  if (SEER_CATEGORY_GROUP.has(category)) {
    return Array.from(SEER_CATEGORY_GROUP).some(seerCat =>
      availableCategories.has(seerCat)
    );
  }

  return false;
}
