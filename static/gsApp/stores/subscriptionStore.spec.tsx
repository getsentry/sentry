import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

import {SubscriptionStore} from './subscriptionStore';

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
      url: `/customers/${organization.slug}/`,
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
      url: `/customers/${organization.slug}/`,
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

  it('allows a new load after a failed load', async () => {
    const failedRequest = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      statusCode: 500,
      body: {},
    });

    await SubscriptionStore.loadData(organization.slug);
    expect(failedRequest).toHaveBeenCalledTimes(1);
    expect(SubscriptionStore.errors[organization.slug]).toBeDefined();
    expect(SubscriptionStore.getState()[organization.slug]).toBeUndefined();

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      body: subscription,
    });

    await SubscriptionStore.loadData(organization.slug);
    expect(SubscriptionStore.errors[organization.slug]).toBeUndefined();
    expect(SubscriptionStore.getState()[organization.slug]).toEqual({
      ...subscription,
      setAt: expect.any(Number),
    });
  });

  it('runs callbacks from a failed load after the next successful load', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      statusCode: 500,
      body: {},
    });
    const failedCallback = jest.fn();

    await SubscriptionStore.get(organization.slug, failedCallback);
    expect(failedCallback).not.toHaveBeenCalled();

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      body: subscription,
    });
    const retryCallback = jest.fn();

    await SubscriptionStore.get(organization.slug, retryCallback);
    const loaded = SubscriptionStore.getState()[organization.slug];
    expect(failedCallback).toHaveBeenCalledTimes(1);
    expect(failedCallback).toHaveBeenCalledWith(loaded);
    expect(retryCallback).toHaveBeenCalledWith(loaded);
  });

  it('shares one request between concurrent loads', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      statusCode: 500,
      body: {},
    });

    await Promise.all([
      SubscriptionStore.loadData(organization.slug),
      SubscriptionStore.loadData(organization.slug),
    ]);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('should return stable reference from getState', () => {
    SubscriptionStore.set(organization.slug, subscription);
    const state = SubscriptionStore.getState();
    expect(Object.is(state, SubscriptionStore.getState())).toBe(true);
  });
});
