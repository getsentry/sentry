import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

import SubscriptionStore from './subscriptionStore';

describe('SubscriptionStore', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});

  beforeEach(() => {
    SubscriptionStore.init();
  });

  it('should set data', () => {
    SubscriptionStore.set(organization.slug, subscription);
    expect(SubscriptionStore.getState()[organization.slug]).toEqual({
      ...subscription,
      setAt: expect.any(Number),
    });
  });

  it('should load data', async () => {
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      body: subscription,
    });

    await SubscriptionStore.loadData(organization.slug);
    expect(SubscriptionStore.getState()[organization.slug]).toEqual({
      ...subscription,
      setAt: expect.any(Number),
    });
  });

  it('should mark trial started and clear trial', async () => {
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      body: subscription,
    });

    const callback = jest.fn();
    await SubscriptionStore.loadData(organization.slug, callback, {
      markStartedTrial: true,
    });
    expect(SubscriptionStore.getState()[organization.slug]!.isTrialStarted).toBe(true);
    expect(callback).toHaveBeenCalledWith(
      SubscriptionStore.getState()[organization.slug]
    );

    SubscriptionStore.clearStartedTrial(organization.slug);
    expect(
      SubscriptionStore.getState()[organization.slug]!.isTrialStarted
    ).toBeUndefined();
  });

  it('should return stable reference from getState', () => {
    SubscriptionStore.set(organization.slug, subscription);
    const state = SubscriptionStore.getState();
    expect(Object.is(state, SubscriptionStore.getState())).toBe(true);
  });
});
