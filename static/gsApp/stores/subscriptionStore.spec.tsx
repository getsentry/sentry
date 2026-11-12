import * as Sentry from '@sentry/react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

import {RequestError} from 'sentry/utils/requestError/requestError';

import {SubscriptionStore} from './subscriptionStore';

describe('SubscriptionStore', () => {
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});

  beforeEach(() => {
    SubscriptionStore.init();
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  it('notifies subscribers when a subscription is set', () => {
    const listener = jest.fn();
    const unsubscribe = SubscriptionStore.subscribe(listener);

    SubscriptionStore.set(organization.slug, subscription);

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
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

  it('does not store an empty response as a subscription', async () => {
    jest.spyOn(Sentry, 'captureException').mockImplementation(() => '');
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      body: '',
    });

    await SubscriptionStore.loadData(organization.slug);
    expect(SubscriptionStore.errors[organization.slug]).toBeDefined();
    expect(SubscriptionStore.getState()[organization.slug]).toBeUndefined();
  });

  it('only updates a subscription that has loaded', () => {
    SubscriptionStore.update(organization.slug, {hasDismissedTrialEndingNotice: true});
    expect(SubscriptionStore.getState()[organization.slug]).toBeUndefined();

    SubscriptionStore.set(organization.slug, subscription);
    SubscriptionStore.update(organization.slug, {hasDismissedTrialEndingNotice: true});
    expect(
      SubscriptionStore.getState()[organization.slug]!.hasDismissedTrialEndingNotice
    ).toBe(true);
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

  it('runs a callback passed to loadData only if that load succeeds', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      statusCode: 500,
      body: {},
    });
    const failedCallback = jest.fn();

    await SubscriptionStore.loadData(organization.slug, failedCallback);
    expect(failedCallback).not.toHaveBeenCalled();

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      body: subscription,
    });
    const succeededCallback = jest.fn();

    await SubscriptionStore.loadData(organization.slug, succeededCallback);
    const loaded = SubscriptionStore.getState()[organization.slug];
    expect(failedCallback).not.toHaveBeenCalled();
    expect(succeededCallback).toHaveBeenCalledTimes(1);
    expect(succeededCallback).toHaveBeenCalledWith(loaded);
  });

  it('reports the first failed load to Sentry until a load succeeds', async () => {
    const captureException = jest
      .spyOn(Sentry, 'captureException')
      .mockImplementation(() => '');
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      statusCode: 503,
      body: {},
    });

    await SubscriptionStore.loadData(organization.slug);
    await SubscriptionStore.loadData(organization.slug);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(
      SubscriptionStore.errors[organization.slug]
    );

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      body: subscription,
    });
    await SubscriptionStore.loadData(organization.slug);

    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      statusCode: 502,
      body: {},
    });
    await SubscriptionStore.loadData(organization.slug);
    expect(captureException).toHaveBeenCalledTimes(2);
  });

  it('reports a load that never reaches the backend', async () => {
    const captureException = jest
      .spyOn(Sentry, 'captureException')
      .mockImplementation(() => '');
    // requestPromise rejects with a status-less RequestError when the fetch itself fails.
    const networkError = new RequestError(
      'GET',
      `/customers/${organization.slug}/`,
      new Error('API Request Error')
    );
    jest.spyOn(SubscriptionStore.api, 'requestPromise').mockRejectedValue(networkError);

    await SubscriptionStore.loadData(organization.slug);
    expect(captureException).toHaveBeenCalledWith(networkError);
  });

  // The backend reports its own 500s, and 4xx responses are not outages.
  it.each([500, 404, 403])('does not report a load that fails with %s', async status => {
    const captureException = jest
      .spyOn(Sentry, 'captureException')
      .mockImplementation(() => '');
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      statusCode: status,
      body: {},
    });

    await SubscriptionStore.loadData(organization.slug);
    expect(SubscriptionStore.errors[organization.slug]).toBeDefined();
    expect(captureException).not.toHaveBeenCalled();
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
