import {createStore} from 'reflux';

import {Client} from 'sentry/api';
import type {StrictStoreDefinition} from 'sentry/stores/types';

import type {Subscription} from 'getsentry/types';

type GetCallback = (data: Subscription) => void;

type LoadOptions = {
  markStartedTrial?: boolean;
};

/**
 * Mapping of organizaton slug to subscription details
 */
type Subscriptions = Record<string, Subscription>;

interface Internal {
  api: Client;
  callbacks: Record<string, GetCallback[]>;
  loadingData: Record<string, boolean>;
}

interface SubscriptionStoreDefintion
  extends StrictStoreDefinition<Subscriptions>,
    Internal {
  clearStartedTrial: (orgSlug: string) => void;
  get: (orgSlug: string, callback: GetCallback) => void;
  loadData: (
    orgSlug: string,
    callback?: null | GetCallback,
    options?: LoadOptions
  ) => Promise<void>;
  set: (orgSlug: string, data: Partial<Subscription>) => void;
}

const subscriptionStoreConfig: SubscriptionStoreDefintion = {
  api: new Client(),
  state: {},
  loadingData: {},
  callbacks: {},

  init() {
    this.api = new Client();
    this.state = {};
    this.loadingData = {};
    this.callbacks = {};
  },

  set(orgSlug: string, data: Partial<Subscription>) {
    const subscription = {
      ...(this.state[orgSlug]! || {}),
      ...data,
      setAt: Date.now(), // Refetch usage data if Subscription is updated
    };

    this.state = {...this.state, [orgSlug]: subscription};
    this.trigger(subscription);

    if (this.callbacks[orgSlug]) {
      this.callbacks[orgSlug].forEach(cb => cb(subscription));
      delete this.callbacks[orgSlug];
    }
  },

  get(orgSlug: string, callback: GetCallback) {
    if (this.state[orgSlug]) {
      callback(this.state[orgSlug]);
      return;
    }

    this.loadData(orgSlug, callback);
  },

  getState() {
    return this.state;
  },

  clearStartedTrial(orgSlug: string) {
    if (!this.state[orgSlug]) {
      return;
    }

    // Do not use this.set() as there is no new data and we do not need to
    // update subscription.setAt
    // Remove isTrialStarted from subscription
    const {isTrialStarted: _, ...subscription} = this.state[orgSlug];
    this.state = {...this.state, [orgSlug]: subscription};
    this.trigger(this.state[orgSlug]);
  },

  async loadData(
    orgSlug: string,
    callback?: null | GetCallback,
    {markStartedTrial} = {}
  ) {
    if (this.callbacks[orgSlug] === undefined) {
      this.callbacks[orgSlug] = [];
    }

    if (typeof callback === 'function') {
      this.callbacks[orgSlug].push(callback);
    }

    if (this.loadingData[orgSlug]) {
      return;
    }
    this.loadingData[orgSlug] = true;

    const data = await this.api.requestPromise(`/subscriptions/${orgSlug}/`);
    if (markStartedTrial) {
      data.isTrialStarted = true;
    }

    this.set(orgSlug, data);
    delete this.loadingData[orgSlug];
  },
};

const SubscriptionStore = createStore(subscriptionStoreConfig);

export default SubscriptionStore;
