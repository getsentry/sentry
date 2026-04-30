import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {useScmFeatureMeta} from 'getsentry/hooks/useScmFeatureMeta';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';

describe('useScmFeatureMeta (gsApp)', () => {
  beforeEach(() => {
    SubscriptionStore.init();
    MockApiClient.clearMockResponses();
  });

  it('returns dynamic volumes from billing-config response', async () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({organization, planTier: PlanTier.AM3});
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      query: {tier: 'am3'},
      body: BillingConfigFixture(PlanTier.AM3),
    });

    const {result} = renderHookWithProviders(useScmFeatureMeta, {organization});

    await waitFor(() => {
      expect(result.current[ProductSolution.ERROR_MONITORING].volume).toBe(
        '50,000 errors / mo'
      );
    });
    expect(result.current[ProductSolution.PERFORMANCE_MONITORING].volume).toBe(
      '10M spans / mo'
    );
    expect(result.current[ProductSolution.SESSION_REPLAY].volume).toBe('50 replays / mo');
    expect(result.current[ProductSolution.LOGS].volume).toBe('5 GB logs / mo');
    // Profile duration in the free plan is 0 → fallback "Usage-based" still wins.
    expect(result.current[ProductSolution.PROFILING].volume).toBe('Usage-based');
  });

  it('falls back to static volumes when billing-config errors', async () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({organization, planTier: PlanTier.AM3});
    SubscriptionStore.set(organization.slug, subscription);
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      query: {tier: 'am3'},
      statusCode: 404,
      body: {detail: 'Not Found'},
    });

    const {result} = renderHookWithProviders(useScmFeatureMeta, {organization});

    await waitFor(() => {
      expect(result.current[ProductSolution.ERROR_MONITORING].volume).toBe(
        '5,000 errors / mo'
      );
    });
    expect(result.current[ProductSolution.PERFORMANCE_MONITORING].volume).toBe(
      '5M spans / mo'
    );
  });

  it('returns fallback volumes when subscription store is empty', () => {
    const organization = OrganizationFixture();
    const {result} = renderHookWithProviders(useScmFeatureMeta, {organization});

    expect(result.current[ProductSolution.ERROR_MONITORING].volume).toBe(
      '5,000 errors / mo'
    );
    expect(result.current[ProductSolution.PERFORMANCE_MONITORING].volume).toBe(
      '5M spans / mo'
    );
  });
});
