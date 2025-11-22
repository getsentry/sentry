import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {Field} from 'sentry/components/forms/types';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {DataCategory} from 'sentry/types/core';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Plan} from 'getsentry/types';

import {useFilterCategoryFields} from './useFilterCategoryFields';

describe('useFilterCategoryFields', () => {
  beforeEach(() => {
    OrganizationsStore.load([]);
    SubscriptionStore.init();
  });

  const createField = (name: string): Field => ({
    name,
    type: 'select',
    label: name,
    choices: [
      ['always', 'On'],
      ['never', 'Off'],
    ],
  });

  const createPlanDetails = (categories: DataCategory[]): Partial<Plan> => ({
    id: 'test_plan',
    categories,
    addOnCategories: {},
  });

  describe('Basic Filtering', () => {
    it('should show fields for categories available in subscription', () => {
      const org = OrganizationFixture({slug: 'test-org'});
      OrganizationsStore.load([org]);

      const subscription = SubscriptionFixture({
        organization: org,
        planDetails: createPlanDetails([
          DataCategory.ERRORS,
          DataCategory.REPLAYS,
        ]) as Plan,
      });
      SubscriptionStore.set(org.slug, subscription);

      const fields = [
        createField('quotaErrors'),
        createField('quotaReplays'),
        createField('quotaTransactions'),
      ];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      expect(result.current).toHaveLength(2);
      expect(result.current.map(f => f.name)).toEqual(['quotaErrors', 'quotaReplays']);
    });

    it('should hide fields for categories not in subscription', () => {
      const org = OrganizationFixture({slug: 'test-org'});
      OrganizationsStore.load([org]);

      const subscription = SubscriptionFixture({
        organization: org,
        planDetails: createPlanDetails([DataCategory.ERRORS]) as Plan,
      });
      SubscriptionStore.set(org.slug, subscription);

      const fields = [
        createField('quotaErrors'),
        createField('quotaReplays'),
        createField('quotaProfileDuration'),
      ];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('quotaErrors');
    });
  });

  describe('Always-Visible Fields', () => {
    it('should always show quota field regardless of subscription', () => {
      const org = OrganizationFixture({slug: 'test-org'});
      OrganizationsStore.load([org]);

      const subscription = SubscriptionFixture({
        organization: org,
        planDetails: createPlanDetails([DataCategory.ERRORS]) as Plan,
      });
      SubscriptionStore.set(org.slug, subscription);

      const fields = [createField('quota'), createField('quotaWarnings')];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      expect(result.current).toHaveLength(2);
      expect(result.current.map(f => f.name)).toEqual(['quota', 'quotaWarnings']);
    });

    it('should always show quotaSpendAllocations field', () => {
      const org = OrganizationFixture({slug: 'test-org'});
      OrganizationsStore.load([org]);

      const subscription = SubscriptionFixture({
        organization: org,
        planDetails: createPlanDetails([DataCategory.ERRORS]) as Plan,
      });
      SubscriptionStore.set(org.slug, subscription);

      const fields = [createField('quotaSpendAllocations'), createField('quotaReplays')];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('quotaSpendAllocations');
    });
  });

  describe('Multi-Organization Support', () => {
    it('should show field if ANY organization has the category', () => {
      const org1 = OrganizationFixture({slug: 'org-1'});
      const org2 = OrganizationFixture({slug: 'org-2'});
      OrganizationsStore.load([org1, org2]);

      // Org 1 has errors and transactions
      const subscription1 = SubscriptionFixture({
        organization: org1,
        planDetails: createPlanDetails([
          DataCategory.ERRORS,
          DataCategory.TRANSACTIONS,
        ]) as Plan,
      });
      SubscriptionStore.set(org1.slug, subscription1);

      // Org 2 has errors and replays
      const subscription2 = SubscriptionFixture({
        organization: org2,
        planDetails: createPlanDetails([
          DataCategory.ERRORS,
          DataCategory.REPLAYS,
        ]) as Plan,
      });
      SubscriptionStore.set(org2.slug, subscription2);

      const fields = [
        createField('quotaErrors'), // Both orgs
        createField('quotaTransactions'), // Org 1 only
        createField('quotaReplays'), // Org 2 only
        createField('quotaProfileDuration'), // Neither org
      ];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      expect(result.current).toHaveLength(3);
      expect(result.current.map(f => f.name)).toEqual([
        'quotaErrors',
        'quotaTransactions',
        'quotaReplays',
      ]);
    });

    it('should handle orgs with no subscription data', () => {
      const org1 = OrganizationFixture({slug: 'org-1'});
      const org2 = OrganizationFixture({slug: 'org-2'});
      OrganizationsStore.load([org1, org2]);

      // Only org1 has subscription
      const subscription1 = SubscriptionFixture({
        organization: org1,
        planDetails: createPlanDetails([DataCategory.ERRORS]) as Plan,
      });
      SubscriptionStore.set(org1.slug, subscription1);
      // org2 has no subscription data

      const fields = [createField('quotaErrors'), createField('quotaReplays')];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      // Should filter based on available subscription data (org1)
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('quotaErrors');
    });
  });

  describe('Transaction vs Span Logic (AM1/AM2 vs AM3)', () => {
    it('should show transactions when at least one org has transactions', () => {
      const org1 = OrganizationFixture({slug: 'org-am2'});
      const org2 = OrganizationFixture({slug: 'org-am3'});
      OrganizationsStore.load([org1, org2]);

      // AM2 org with transactions
      const subscriptionAm2 = SubscriptionFixture({
        organization: org1,
        planDetails: createPlanDetails([
          DataCategory.ERRORS,
          DataCategory.TRANSACTIONS,
        ]) as Plan,
      });
      SubscriptionStore.set(org1.slug, subscriptionAm2);

      // AM3 org with spans
      const subscriptionAm3 = SubscriptionFixture({
        organization: org2,
        planDetails: createPlanDetails([
          DataCategory.ERRORS,
          DataCategory.SPANS_INDEXED,
        ]) as Plan,
      });
      SubscriptionStore.set(org2.slug, subscriptionAm3);

      const fields = [
        createField('quotaTransactions'),
        createField('quotaSpans'),
        createField('quotaErrors'),
      ];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      // Should show both transactions and spans
      expect(result.current).toHaveLength(3);
      expect(result.current.map(f => f.name)).toEqual([
        'quotaTransactions',
        'quotaSpans',
        'quotaErrors',
      ]);
    });

    it('should hide transactions when ALL orgs are AM3 (spans only)', () => {
      const org1 = OrganizationFixture({slug: 'org-am3-1'});
      const org2 = OrganizationFixture({slug: 'org-am3-2'});
      OrganizationsStore.load([org1, org2]);

      // Both orgs have spans but not transactions
      const subscriptionAm3_1 = SubscriptionFixture({
        organization: org1,
        planDetails: createPlanDetails([
          DataCategory.ERRORS,
          DataCategory.SPANS_INDEXED,
        ]) as Plan,
      });
      const subscriptionAm3_2 = SubscriptionFixture({
        organization: org2,
        planDetails: createPlanDetails([
          DataCategory.ERRORS,
          DataCategory.SPANS_INDEXED,
        ]) as Plan,
      });
      SubscriptionStore.set(org1.slug, subscriptionAm3_1);
      SubscriptionStore.set(org2.slug, subscriptionAm3_2);

      const fields = [
        createField('quotaTransactions'),
        createField('quotaSpans'),
        createField('quotaErrors'),
      ];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      // Should hide transactions, show spans and errors
      expect(result.current).toHaveLength(2);
      expect(result.current.map(f => f.name)).toEqual(['quotaSpans', 'quotaErrors']);
    });

    it('should show transactions when org has only transactions (AM1/AM2)', () => {
      const org = OrganizationFixture({slug: 'org-am2'});
      OrganizationsStore.load([org]);

      const subscription = SubscriptionFixture({
        organization: org,
        planDetails: createPlanDetails([
          DataCategory.ERRORS,
          DataCategory.TRANSACTIONS,
        ]) as Plan,
      });
      SubscriptionStore.set(org.slug, subscription);

      const fields = [
        createField('quotaTransactions'),
        createField('quotaSpans'),
        createField('quotaErrors'),
      ];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      // Should show transactions and errors, hide spans
      expect(result.current).toHaveLength(2);
      expect(result.current.map(f => f.name)).toEqual([
        'quotaTransactions',
        'quotaErrors',
      ]);
    });

    it('should handle TRANSACTIONS_INDEXED category', () => {
      const org = OrganizationFixture({slug: 'org'});
      OrganizationsStore.load([org]);

      const subscription = SubscriptionFixture({
        organization: org,
        planDetails: createPlanDetails([
          DataCategory.ERRORS,
          DataCategory.TRANSACTIONS_INDEXED,
        ]) as Plan,
      });
      SubscriptionStore.set(org.slug, subscription);

      const fields = [createField('quotaTransactionsIndexed'), createField('quotaSpans')];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      // Should show transactions, hide spans
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('quotaTransactionsIndexed');
    });
  });

  describe('Seer Grouped Categories', () => {
    it('should show Seer fields when SEER_AUTOFIX is available', () => {
      const org = OrganizationFixture({slug: 'test-org'});
      OrganizationsStore.load([org]);

      const subscription = SubscriptionFixture({
        organization: org,
        planDetails: createPlanDetails([
          DataCategory.ERRORS,
          DataCategory.SEER_AUTOFIX,
        ]) as Plan,
      });
      SubscriptionStore.set(org.slug, subscription);

      const fields = [
        createField('quotaSeerBudget'),
        createField('quotaSeerAutofix'),
        createField('quotaSeerScanner'),
      ];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      // All Seer fields should be shown
      expect(result.current).toHaveLength(3);
    });

    it('should show Seer fields when SEER_SCANNER is available', () => {
      const org = OrganizationFixture({slug: 'test-org'});
      OrganizationsStore.load([org]);

      const subscription = SubscriptionFixture({
        organization: org,
        planDetails: createPlanDetails([
          DataCategory.ERRORS,
          DataCategory.SEER_SCANNER,
        ]) as Plan,
      });
      SubscriptionStore.set(org.slug, subscription);

      const fields = [
        createField('quotaSeerBudget'),
        createField('quotaSeerAutofix'),
        createField('quotaSeerScanner'),
      ];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      // All Seer fields should be shown due to grouping
      expect(result.current).toHaveLength(3);
    });

    it('should hide Seer fields when no Seer categories available', () => {
      const org = OrganizationFixture({slug: 'test-org'});
      OrganizationsStore.load([org]);

      const subscription = SubscriptionFixture({
        organization: org,
        planDetails: createPlanDetails([DataCategory.ERRORS]) as Plan,
      });
      SubscriptionStore.set(org.slug, subscription);

      const fields = [
        createField('quotaErrors'),
        createField('quotaSeerBudget'),
        createField('quotaSeerAutofix'),
      ];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      // Only errors should be shown
      expect(result.current).toHaveLength(1);
      expect(result.current[0].name).toBe('quotaErrors');
    });
  });

  describe('Fallback Behavior', () => {
    it('should show all fields when no subscription data is available', () => {
      const org = OrganizationFixture({slug: 'test-org'});
      OrganizationsStore.load([org]);
      // No subscription data loaded

      const fields = [
        createField('quotaErrors'),
        createField('quotaReplays'),
        createField('quotaProfileDuration'),
      ];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      // Should show all fields (permissive fallback)
      expect(result.current).toHaveLength(3);
    });

    it('should show all fields when organizations array is empty', () => {
      OrganizationsStore.load([]);

      const fields = [
        createField('quotaErrors'),
        createField('quotaReplays'),
        createField('quotaProfileDuration'),
      ];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      // Should show all fields (permissive fallback)
      expect(result.current).toHaveLength(3);
    });

    it('should show all fields when planDetails is missing', () => {
      const org = OrganizationFixture({slug: 'test-org'});
      OrganizationsStore.load([org]);

      const subscription = SubscriptionFixture({
        organization: org,
        planDetails: undefined,
      });
      SubscriptionStore.set(org.slug, subscription);

      const fields = [createField('quotaErrors'), createField('quotaReplays')];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      // Should show all fields (permissive fallback)
      expect(result.current).toHaveLength(2);
    });
  });

  describe('Various Categories', () => {
    it('should handle profile duration categories', () => {
      const org = OrganizationFixture({slug: 'test-org'});
      OrganizationsStore.load([org]);

      const subscription = SubscriptionFixture({
        organization: org,
        planDetails: createPlanDetails([
          DataCategory.ERRORS,
          DataCategory.PROFILE_DURATION,
          DataCategory.PROFILE_DURATION_UI,
        ]) as Plan,
      });
      SubscriptionStore.set(org.slug, subscription);

      const fields = [
        createField('quotaProfileDuration'),
        createField('quotaProfileDurationUI'),
        createField('quotaReplays'),
      ];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      expect(result.current).toHaveLength(2);
      expect(result.current.map(f => f.name)).toEqual([
        'quotaProfileDuration',
        'quotaProfileDurationUI',
      ]);
    });

    it('should handle log categories', () => {
      const org = OrganizationFixture({slug: 'test-org'});
      OrganizationsStore.load([org]);

      const subscription = SubscriptionFixture({
        organization: org,
        planDetails: createPlanDetails([
          DataCategory.ERRORS,
          DataCategory.LOG_BYTE,
        ]) as Plan,
      });
      SubscriptionStore.set(org.slug, subscription);

      const fields = [
        createField('quotaLogBytes'),
        createField('quotaLogItems'),
        createField('quotaErrors'),
      ];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      expect(result.current).toHaveLength(2);
      expect(result.current.map(f => f.name)).toEqual(['quotaLogBytes', 'quotaErrors']);
    });

    it('should handle Prevent categories', () => {
      const org = OrganizationFixture({slug: 'test-org'});
      OrganizationsStore.load([org]);

      const subscription = SubscriptionFixture({
        organization: org,
        planDetails: createPlanDetails([
          DataCategory.ERRORS,
          DataCategory.PREVENT_USER,
        ]) as Plan,
      });
      SubscriptionStore.set(org.slug, subscription);

      const fields = [
        createField('quotaPreventUsers'),
        createField('quotaPreventReviews'),
        createField('quotaErrors'),
      ];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      expect(result.current).toHaveLength(2);
      expect(result.current.map(f => f.name)).toEqual([
        'quotaPreventUsers',
        'quotaErrors',
      ]);
    });

    it('should handle monitor categories', () => {
      const org = OrganizationFixture({slug: 'test-org'});
      OrganizationsStore.load([org]);

      const subscription = SubscriptionFixture({
        organization: org,
        planDetails: createPlanDetails([
          DataCategory.ERRORS,
          DataCategory.MONITOR,
          DataCategory.MONITOR_SEATS,
        ]) as Plan,
      });
      SubscriptionStore.set(org.slug, subscription);

      const fields = [
        createField('quotaMonitors'),
        createField('quotaMonitorSeats'),
        createField('quotaReplays'),
      ];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      expect(result.current).toHaveLength(2);
      expect(result.current.map(f => f.name)).toEqual([
        'quotaMonitors',
        'quotaMonitorSeats',
      ]);
    });
  });

  describe('Unknown Fields', () => {
    it('should show fields not in the mapping by default', () => {
      const org = OrganizationFixture({slug: 'test-org'});
      OrganizationsStore.load([org]);

      const subscription = SubscriptionFixture({
        organization: org,
        planDetails: createPlanDetails([DataCategory.ERRORS]) as Plan,
      });
      SubscriptionStore.set(org.slug, subscription);

      const fields = [
        createField('quotaErrors'),
        createField('unknownField'), // Not in mapping
      ];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      // Should show both (unknown fields shown by default)
      expect(result.current).toHaveLength(2);
    });
  });

  describe('Free Plan', () => {
    it('should show only error notifications for free plan', () => {
      const org = OrganizationFixture({slug: 'test-org'});
      OrganizationsStore.load([org]);

      const subscription = SubscriptionFixture({
        organization: org,
        planDetails: createPlanDetails([DataCategory.ERRORS]) as Plan, // Free plan typically only has errors
      });
      SubscriptionStore.set(org.slug, subscription);

      const fields = [
        createField('quota'),
        createField('quotaWarnings'),
        createField('quotaErrors'),
        createField('quotaReplays'),
        createField('quotaTransactions'),
      ];

      const {result} = renderHook(() => useFilterCategoryFields(fields));

      expect(result.current).toHaveLength(3);
      expect(result.current.map(f => f.name)).toEqual([
        'quota',
        'quotaWarnings',
        'quotaErrors',
      ]);
    });
  });
});
