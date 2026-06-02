import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useScmTrialBanner} from 'getsentry/overrides/useScmTrialBanner';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';

describe('useScmTrialBanner', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    SubscriptionStore.init();
  });

  it('shows the banner with days remaining for an active trial', () => {
    const organization = OrganizationFixture();
    const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({organization, isTrial: true, isFree: false, trialEnd})
    );

    const {result} = renderHookWithProviders(useScmTrialBanner, {organization});

    expect(result.current.showTrialBanner).toBe(true);
    expect(result.current.trialDaysLeft).toBe(14);
  });

  it('hides the banner for a free org with no trial', () => {
    const organization = OrganizationFixture();
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({organization, isTrial: false, isFree: true})
    );

    const {result} = renderHookWithProviders(useScmTrialBanner, {organization});

    expect(result.current.showTrialBanner).toBe(false);
  });

  it('hides the banner for a paid org', () => {
    const organization = OrganizationFixture();
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({
        organization,
        plan: 'am3_business',
        isTrial: false,
        isFree: false,
      })
    );

    const {result} = renderHookWithProviders(useScmTrialBanner, {organization});

    expect(result.current.showTrialBanner).toBe(false);
  });
});
