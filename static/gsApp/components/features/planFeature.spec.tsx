import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import PlanFeature from 'getsentry/components/features/planFeature';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';

describe('PlanFeature', function () {
  const organization = OrganizationFixture();

  beforeEach(() => {
    SubscriptionStore.init();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      query: {tier: 'am2'},
      body: BillingConfigFixture(PlanTier.AM2),
    });
  });

  it('provides the plan required for a feature', async function () {
    const mockFn = jest.fn(() => null);

    const sub = SubscriptionFixture({organization, planTier: PlanTier.MM2});
    SubscriptionStore.set(organization.slug, sub);

    render(
      <PlanFeature organization={organization} features={['sso-basic']}>
        {mockFn}
      </PlanFeature>
    );

    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith({
        plan: PlanDetailsLookupFixture('am2_team'),
        tierChange: 'am2',
      });
    });
  });

  it('provides the business plan', async function () {
    const mockFn = jest.fn(() => null);

    const sub = SubscriptionFixture({organization, planTier: PlanTier.MM2});
    SubscriptionStore.set(organization.slug, sub);

    render(
      <PlanFeature organization={organization} features={['discard-groups']}>
        {mockFn}
      </PlanFeature>
    );

    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith({
        plan: PlanDetailsLookupFixture('am2_business'),
        tierChange: 'am2',
      });
    });
  });

  it('provides no plan if the feature is not on a plan', async function () {
    const mockFn = jest.fn(() => null);

    const sub = SubscriptionFixture({organization, planTier: PlanTier.MM2});
    SubscriptionStore.set(organization.slug, sub);

    render(
      <PlanFeature organization={organization} features={['invalid-feature']}>
        {mockFn}
      </PlanFeature>
    );

    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith({plan: null, tierChange: null});
    });
  });

  it('provides a plan when the tiers mismatch', async function () {
    const mockFn = jest.fn(() => null);

    const sub = SubscriptionFixture({
      organization,
      contractInterval: 'annual',
      planTier: PlanTier.MM2,
    });
    SubscriptionStore.set(organization.slug, sub);

    render(
      <PlanFeature organization={organization} features={['discard-groups']}>
        {mockFn}
      </PlanFeature>
    );

    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith({
        plan: PlanDetailsLookupFixture('am2_business'),
        tierChange: 'am2',
      });
    });
  });

  it('reports tier change as null when no tier change is required', async function () {
    const mockFn = jest.fn(() => null);

    const sub = SubscriptionFixture({organization, planTier: 'am2'});
    SubscriptionStore.set(organization.slug, sub);

    render(
      <PlanFeature organization={organization} features={['discard-groups']}>
        {mockFn}
      </PlanFeature>
    );

    await waitFor(() => {
      expect(mockFn).toHaveBeenCalledWith({
        plan: PlanDetailsLookupFixture('am2_business'),
        tierChange: null,
      });
    });
  });

  it('provides the business plan for am3', async function () {
    const mockFn = jest.fn(() => null);
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      query: {tier: 'am3'},
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
        tierChange: 'am3',
      });
    });
  });

  it('offers business upgrade if on sponsored plan', async function () {
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
        tierChange: 'am2',
      });
    });
  });
});
