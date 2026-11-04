import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useSubscription} from 'getsentry/hooks/useSubscription';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';

describe('useSubscription', () => {
  const organization = OrganizationFixture({slug: 'context-org'});
  const otherOrganization = OrganizationFixture({id: '2', slug: 'other-org'});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    SubscriptionStore.init();
  });

  it('returns the cached subscription without fetching when it is in the store', () => {
    const subscription = SubscriptionFixture({organization});
    SubscriptionStore.set(organization.slug, subscription);
    const customerRequest = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      body: subscription,
    });

    const {result} = renderHookWithProviders(() => useSubscription(), {organization});

    expect(result.current).toEqual(expect.objectContaining({id: subscription.id}));
    expect(customerRequest).not.toHaveBeenCalled();
  });

  it('loads the subscription when it is not in the store', async () => {
    const subscription = SubscriptionFixture({organization, plan: 'am3_team'});
    const customerRequest = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      body: subscription,
    });

    const {result} = renderHookWithProviders(() => useSubscription(), {organization});

    await waitFor(() => expect(result.current?.plan).toBe('am3_team'));
    expect(customerRequest).toHaveBeenCalledTimes(1);
  });

  it('loads the subscription only once when several callers mount together', async () => {
    const customerRequest = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      body: SubscriptionFixture({organization}),
    });

    const {result} = renderHookWithProviders(
      () => [useSubscription(), useSubscription()],
      {organization}
    );

    await waitFor(() => expect(result.current[1]).not.toBeNull());
    expect(customerRequest).toHaveBeenCalledTimes(1);
  });

  it('returns the subscription for the given organization when it differs from context', async () => {
    SubscriptionStore.set(organization.slug, SubscriptionFixture({organization}));
    MockApiClient.addMockResponse({
      url: `/customers/${otherOrganization.slug}/`,
      body: SubscriptionFixture({organization: otherOrganization, plan: 'am3_business'}),
    });

    const {result} = renderHookWithProviders(
      () => useSubscription({organization: otherOrganization}),
      {organization}
    );

    await waitFor(() => expect(result.current?.plan).toBe('am3_business'));
  });

  it('returns null without fetching when there is no organization', () => {
    const {result} = renderHookWithProviders(() => useSubscription(), {
      organization: null,
    });

    expect(result.current).toBeNull();
  });
});
