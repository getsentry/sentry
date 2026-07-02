import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {PlanTier} from 'getsentry-test/planTier';
import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import PlanFeature from 'getsentry/components/features/planFeature';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';

describe('PlanFeature', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    SubscriptionStore.init();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      query: {tier: 'upsell'},
      body: BillingConfigFixture(PlanTier.AM2),
    });
  });

  it('provides the plan required for a feature', async () => {
    const mockFn = jest.fn(() => null);

    const sub = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, sub);

    render(
      <PlanFeature organization={organization} features={['sso-basic']}>
        {mockFn}
      </PlanFeature>
    );

    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith({
        plan: PlanDetailsLookupFixture('am2_team'),
      });
    });
  });

  it('provides the business plan', async () => {
    const mockFn = jest.fn(() => null);

    const sub = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, sub);

    render(
      <PlanFeature organization={organization} features={['discard-groups']}>
        {mockFn}
      </PlanFeature>
    );

    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith({
        plan: PlanDetailsLookupFixture('am2_business'),
      });
    });
  });

  it('provides no plan if the feature is not on a plan', async () => {
    const mockFn = jest.fn(() => null);

    const sub = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, sub);

    render(
      <PlanFeature organization={organization} features={['invalid-feature']}>
        {mockFn}
      </PlanFeature>
    );

    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith({plan: null});
    });
  });

  it('provides the annual plan when the billing interval is annual', async () => {
    const mockFn = jest.fn(() => null);

    const sub = SubscriptionFixture({
      organization,
      billingInterval: 'annual',
    });
    SubscriptionStore.set(organization.slug, sub);

    render(
      <PlanFeature organization={organization} features={['discard-groups']}>
        {mockFn}
      </PlanFeature>
    );

    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith({
        plan: PlanDetailsLookupFixture('am2_business_auf'),
      });
    });
  });

  it('provides the business plan for am3', async () => {
    const mockFn = jest.fn(() => null);
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      query: {tier: 'upsell'},
      body: BillingConfigFixture(PlanTier.AM3),
    });

    const sub = SubscriptionFixture({organization, plan: 'am3_team'});
    SubscriptionStore.set(organization.slug, sub);

    render(
      <PlanFeature organization={organization} features={['discard-groups']}>
        {mockFn}
      </PlanFeature>
    );

    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith({
        plan: PlanDetailsLookupFixture('am3_business'),
      });
    });
  });

  it('offers business upgrade if on sponsored plan', async () => {
    const mockFn = jest.fn(() => null);

    const sub = SubscriptionFixture({
      organization,
      plan: 'am2_sponsored',
      isSponsored: true,
    });
    SubscriptionStore.set(organization.slug, sub);

    render(
      <PlanFeature organization={organization} features={['monitor-seat-billing']}>
        {mockFn}
      </PlanFeature>
    );

    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith({
        plan: PlanDetailsLookupFixture('am2_business'),
      });
    });
  });
});
