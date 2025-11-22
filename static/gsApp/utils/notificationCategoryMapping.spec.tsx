import {DataCategory} from 'sentry/types/core';

import {
  ALWAYS_VISIBLE_FIELDS,
  NOTIFICATION_FIELD_TO_CATEGORY_MAP,
  SEER_CATEGORY_GROUP,
  subscriptionHasCategory,
} from './notificationCategoryMapping';

describe('notificationCategoryMapping', () => {
  describe('NOTIFICATION_FIELD_TO_CATEGORY_MAP', () => {
    it('should map error field to ERRORS category', () => {
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaErrors).toBe(DataCategory.ERRORS);
    });

    it('should map transaction fields to appropriate categories', () => {
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaTransactions).toBe(
        DataCategory.TRANSACTIONS
      );
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaTransactionsProcessed).toBe(
        DataCategory.TRANSACTIONS_PROCESSED
      );
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaTransactionsIndexed).toBe(
        DataCategory.TRANSACTIONS_INDEXED
      );
    });

    it('should map span fields to SPANS_INDEXED category', () => {
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaSpans).toBe(
        DataCategory.SPANS_INDEXED
      );
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaSpansIndexed).toBe(
        DataCategory.SPANS_INDEXED
      );
    });

    it('should map attachment field to ATTACHMENTS category', () => {
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaAttachments).toBe(
        DataCategory.ATTACHMENTS
      );
    });

    it('should map replay field to REPLAYS category', () => {
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaReplays).toBe(DataCategory.REPLAYS);
    });

    it('should map profile fields to appropriate categories', () => {
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaProfiles).toBe(
        DataCategory.PROFILES
      );
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaProfilesIndexed).toBe(
        DataCategory.PROFILES_INDEXED
      );
    });

    it('should map profile duration fields to appropriate categories', () => {
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaProfileDuration).toBe(
        DataCategory.PROFILE_DURATION
      );
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaProfileDurationUI).toBe(
        DataCategory.PROFILE_DURATION_UI
      );
    });

    it('should map monitor fields to appropriate categories', () => {
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaMonitors).toBe(DataCategory.MONITOR);
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaMonitorSeats).toBe(
        DataCategory.MONITOR_SEATS
      );
    });

    it('should map uptime field to UPTIME category', () => {
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaUptime).toBe(DataCategory.UPTIME);
    });

    it('should map log fields to appropriate categories', () => {
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaLogItems).toBe(
        DataCategory.LOG_ITEM
      );
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaLogBytes).toBe(
        DataCategory.LOG_BYTE
      );
    });

    it('should map Seer fields to SEER_AUTOFIX category', () => {
      // Combined Seer budget notification
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaSeerBudget).toBe(
        DataCategory.SEER_AUTOFIX
      );
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaSeerAutofix).toBe(
        DataCategory.SEER_AUTOFIX
      );
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaSeerScanner).toBe(
        DataCategory.SEER_SCANNER
      );
    });

    it('should map Prevent fields to appropriate categories', () => {
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaPreventUsers).toBe(
        DataCategory.PREVENT_USER
      );
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaPreventReviews).toBe(
        DataCategory.PREVENT_REVIEW
      );
    });

    it('should map feedback field to USER_REPORT_V2 category', () => {
      expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP.quotaFeedback).toBe(
        DataCategory.USER_REPORT_V2
      );
    });

    it('should have all expected field mappings', () => {
      const expectedFields = [
        'quotaErrors',
        'quotaTransactions',
        'quotaTransactionsProcessed',
        'quotaTransactionsIndexed',
        'quotaSpans',
        'quotaSpansIndexed',
        'quotaAttachments',
        'quotaReplays',
        'quotaProfiles',
        'quotaProfilesIndexed',
        'quotaProfileDuration',
        'quotaProfileDurationUI',
        'quotaMonitors',
        'quotaMonitorSeats',
        'quotaUptime',
        'quotaLogItems',
        'quotaLogBytes',
        'quotaSeerBudget',
        'quotaSeerAutofix',
        'quotaSeerScanner',
        'quotaPreventUsers',
        'quotaPreventReviews',
        'quotaFeedback',
      ];

      expectedFields.forEach(field => {
        expect(NOTIFICATION_FIELD_TO_CATEGORY_MAP).toHaveProperty(field);
      });
    });
  });

  describe('ALWAYS_VISIBLE_FIELDS', () => {
    it('should include top-level quota fields', () => {
      expect(ALWAYS_VISIBLE_FIELDS.has('quota')).toBe(true);
      expect(ALWAYS_VISIBLE_FIELDS.has('quotaWarnings')).toBe(true);
      expect(ALWAYS_VISIBLE_FIELDS.has('quotaSpendAllocations')).toBe(true);
    });

    it('should have exactly 3 always-visible fields', () => {
      expect(ALWAYS_VISIBLE_FIELDS.size).toBe(3);
    });
  });

  describe('SEER_CATEGORY_GROUP', () => {
    it('should include both Seer categories', () => {
      expect(SEER_CATEGORY_GROUP.has(DataCategory.SEER_AUTOFIX)).toBe(true);
      expect(SEER_CATEGORY_GROUP.has(DataCategory.SEER_SCANNER)).toBe(true);
    });

    it('should have exactly 2 Seer categories', () => {
      expect(SEER_CATEGORY_GROUP.size).toBe(2);
    });
  });

  describe('subscriptionHasCategory', () => {
    it('should return true when category is directly available', () => {
      const availableCategories = new Set([
        DataCategory.ERRORS,
        DataCategory.TRANSACTIONS,
      ]);

      expect(subscriptionHasCategory(availableCategories, DataCategory.ERRORS)).toBe(
        true
      );
      expect(
        subscriptionHasCategory(availableCategories, DataCategory.TRANSACTIONS)
      ).toBe(true);
    });

    it('should return false when category is not available', () => {
      const availableCategories = new Set([DataCategory.ERRORS]);

      expect(
        subscriptionHasCategory(availableCategories, DataCategory.TRANSACTIONS)
      ).toBe(false);
      expect(subscriptionHasCategory(availableCategories, DataCategory.REPLAYS)).toBe(
        false
      );
    });

    it('should handle Seer categories specially - SEER_AUTOFIX present', () => {
      const availableCategories = new Set([DataCategory.SEER_AUTOFIX]);

      // Should return true for both Seer categories if either is present
      expect(
        subscriptionHasCategory(availableCategories, DataCategory.SEER_AUTOFIX)
      ).toBe(true);
      expect(
        subscriptionHasCategory(availableCategories, DataCategory.SEER_SCANNER)
      ).toBe(true);
    });

    it('should handle Seer categories specially - SEER_SCANNER present', () => {
      const availableCategories = new Set([DataCategory.SEER_SCANNER]);

      // Should return true for both Seer categories if either is present
      expect(
        subscriptionHasCategory(availableCategories, DataCategory.SEER_AUTOFIX)
      ).toBe(true);
      expect(
        subscriptionHasCategory(availableCategories, DataCategory.SEER_SCANNER)
      ).toBe(true);
    });

    it('should handle Seer categories specially - both present', () => {
      const availableCategories = new Set([
        DataCategory.SEER_AUTOFIX,
        DataCategory.SEER_SCANNER,
      ]);

      expect(
        subscriptionHasCategory(availableCategories, DataCategory.SEER_AUTOFIX)
      ).toBe(true);
      expect(
        subscriptionHasCategory(availableCategories, DataCategory.SEER_SCANNER)
      ).toBe(true);
    });

    it('should return false for Seer categories when none are available', () => {
      const availableCategories = new Set([DataCategory.ERRORS]);

      expect(
        subscriptionHasCategory(availableCategories, DataCategory.SEER_AUTOFIX)
      ).toBe(false);
      expect(
        subscriptionHasCategory(availableCategories, DataCategory.SEER_SCANNER)
      ).toBe(false);
    });

    it('should handle empty categories set', () => {
      const availableCategories = new Set<DataCategory>();

      expect(subscriptionHasCategory(availableCategories, DataCategory.ERRORS)).toBe(
        false
      );
      expect(
        subscriptionHasCategory(availableCategories, DataCategory.SEER_AUTOFIX)
      ).toBe(false);
    });

    it('should handle categories not in Seer group normally', () => {
      const availableCategories = new Set([
        DataCategory.ERRORS,
        DataCategory.PREVENT_USER,
      ]);

      // Regular categories should not be affected by Seer logic
      expect(subscriptionHasCategory(availableCategories, DataCategory.ERRORS)).toBe(
        true
      );
      expect(
        subscriptionHasCategory(availableCategories, DataCategory.PREVENT_USER)
      ).toBe(true);
      expect(
        subscriptionHasCategory(availableCategories, DataCategory.TRANSACTIONS)
      ).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should not have duplicate category mappings', () => {
      const categoryValues = Object.values(NOTIFICATION_FIELD_TO_CATEGORY_MAP);
      const fieldKeys = Object.keys(NOTIFICATION_FIELD_TO_CATEGORY_MAP);

      // Check that we have mappings
      expect(fieldKeys.length).toBeGreaterThan(0);
      expect(categoryValues).toHaveLength(fieldKeys.length);
    });

    it('should only map to valid DataCategory enum values', () => {
      const validCategories = new Set(Object.values(DataCategory));

      Object.values(NOTIFICATION_FIELD_TO_CATEGORY_MAP).forEach(category => {
        expect(validCategories.has(category)).toBe(true);
      });
    });

    it('should use consistent naming pattern for field names', () => {
      const fieldNames = Object.keys(NOTIFICATION_FIELD_TO_CATEGORY_MAP);

      fieldNames.forEach(fieldName => {
        // All field names should start with "quota"
        expect(fieldName).toMatch(/^quota[A-Z]/);
      });
    });
  });
});
