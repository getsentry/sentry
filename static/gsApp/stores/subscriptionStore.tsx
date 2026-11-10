import {createStore} from 'zustand/vanilla';

import {Client} from 'sentry/api';

import type {Subscription} from 'getsentry/types';

type GetCallback = (data: Subscription) => void;

type LoadOptions = {
  markStartedTrial?: boolean;
};

/**
 * Mapping of organization slug to subscription details
 */
type Subscriptions = Readonly<Record<string, Subscription>>;

const store = createStore<Subscriptions>()(() => ({}));

let api = new Client();
let loadingData: Record<string, boolean> = {};
let callbacks: Record<string, GetCallback[]> = {};

export const SubscriptionStore = {
  // State is only written through the methods below.
  getState: store.getState,
  getInitialState: store.getInitialState,
  subscribe: store.subscribe,

  /**
   * Empties the store. Only used to reset state between tests.
   */
  init(): void {
    api = new Client();
    loadingData = {};
    callbacks = {};
    store.setState({}, true);
  },

  set(orgSlug: string, data: Partial<Subscription>): void {
    const subscription = {
      ...store.getState()[orgSlug]!,
      ...data,
      setAt: Date.now(), // Refetch usage data if Subscription is updated
    };

    store.setState({[orgSlug]: subscription});

    if (callbacks[orgSlug]) {
      callbacks[orgSlug].forEach(cb => cb(subscription));
      delete callbacks[orgSlug];
    }
  },

  get(orgSlug: string, callback: GetCallback): void {
    const subscription = store.getState()[orgSlug];
    if (subscription) {
      callback(subscription);
      return;
    }

    SubscriptionStore.loadData(orgSlug, callback);
  },

  clearStartedTrial(orgSlug: string): void {
    const current = store.getState()[orgSlug];
    if (!current) {
      return;
    }

    // Do not use set() as there is no new data and we do not need to
    // update subscription.setAt
    // Remove isTrialStarted from subscription
    const {isTrialStarted: _, ...subscription} = current;
    store.setState({[orgSlug]: subscription});
  },

  async loadData(
    orgSlug: string,
    callback?: null | GetCallback,
    {markStartedTrial}: LoadOptions = {}
  ): Promise<void> {
    callbacks[orgSlug] ??= [];

    if (typeof callback === 'function') {
      callbacks[orgSlug].push(callback);
    }

    if (loadingData[orgSlug]) {
      return;
    }
    loadingData[orgSlug] = true;

    const data: Subscription = await api.requestPromise(`/customers/${orgSlug}/`);
    if (markStartedTrial) {
      data.isTrialStarted = true;
    }

    SubscriptionStore.set(orgSlug, data);
    delete loadingData[orgSlug];
  },
};
