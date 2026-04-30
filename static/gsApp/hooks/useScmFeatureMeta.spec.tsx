import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {useScmFeatureMeta} from 'getsentry/hooks/useScmFeatureMeta';
import {PlanTier} from 'getsentry/types';

describe('useScmFeatureMeta', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('returns dynamic volumes from billing-config response', async () => {
    const organization = OrganizationFixture();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      query: {tier: 'am3'},
      body: BillingConfigFixture(PlanTier.AM3),
    });

    const {result} = renderHookWithProviders(useScmFeatureMeta, {organization});

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.meta[ProductSolution.ERROR_MONITORING].volume).toBe(
      '50,000 errors / mo'
    );
    expect(result.current.meta[ProductSolution.PERFORMANCE_MONITORING].volume).toBe(
      '10M spans / mo'
    );
    expect(result.current.meta[ProductSolution.SESSION_REPLAY].volume).toBe(
      '50 replays / mo'
    );
    expect(result.current.meta[ProductSolution.LOGS].volume).toBe('5 GB logs / mo');
    // PROFILING is intentionally absent from DYNAMIC_FORMATS, so the static
    // "Usage-based" fallback is preserved.
    expect(result.current.meta[ProductSolution.PROFILING].volume).toBe('Usage-based');
  });

  it('falls back to static volumes when billing-config errors', async () => {
    const organization = OrganizationFixture();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      query: {tier: 'am3'},
      statusCode: 404,
      body: {detail: 'Not Found'},
    });

    const {result} = renderHookWithProviders(useScmFeatureMeta, {organization});

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.meta[ProductSolution.ERROR_MONITORING].volume).toBe(
      '5,000 errors / mo'
    );
    expect(result.current.meta[ProductSolution.PERFORMANCE_MONITORING].volume).toBe(
      '5M spans / mo'
    );
  });
});
