import {Client} from 'sentry/api';
import {createLegacyStore} from 'sentry/stores/createLegacyStore';

import type {Subscription} from 'getsentry/types';

type GetCallback = (data: Subscription) => void;

type LoadOptions = {
  markStartedTrial?: boolean;
};

/**
 * Mapping of organizaton slug to subscription details
 */
type Subscriptions = Record<string, Subscription>;

const store = createLegacyStore<Subscriptions>(() => ({}));

export const SubscriptionStore = {
  ...store,
  api: new Client(),
  loadingData: {} as Record<string, boolean>,
  callbacks: {} as Record<string, GetCallback[]>,

  init() {
    SubscriptionStore.api = new Client();
    SubscriptionStore.loadingData = {};
    SubscriptionStore.callbacks = {};
    store.resetState({});
  },

  set(orgSlug: string, data: Partial<Subscription>) {
    const subscription = {
      ...store.getState()[orgSlug]!,
      ...data,
      setAt: Date.now(), // Refetch usage data if Subscription is updated
    };

    store.setState({[orgSlug]: subscription});

    const callbacks = SubscriptionStore.callbacks[orgSlug];
    if (callbacks) {
      callbacks.forEach(cb => cb(subscription));
      delete SubscriptionStore.callbacks[orgSlug];
    }
  },

  get(orgSlug: string, callback: GetCallback) {
    const subscription = store.getState()[orgSlug];
    if (subscription) {
      callback(subscription);
      return;
    }

    SubscriptionStore.loadData(orgSlug, callback);
  },

  clearStartedTrial(orgSlug: string) {
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
  ) {
    const callbacks = (SubscriptionStore.callbacks[orgSlug] ??= []);

    if (typeof callback === 'function') {
      callbacks.push(callback);
    }

    if (SubscriptionStore.loadingData[orgSlug]) {
      return;
    }
    SubscriptionStore.loadingData[orgSlug] = true;

    const data = await SubscriptionStore.api.requestPromise(`/customers/${orgSlug}/`);
    if (markStartedTrial) {
      data.isTrialStarted = true;
    }

    SubscriptionStore.set(orgSlug, data);
    delete SubscriptionStore.loadingData[orgSlug];
  },
};
