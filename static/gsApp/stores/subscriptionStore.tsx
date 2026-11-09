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
  /**
   * The error from the most recent failed load, cleared by the next successful one.
   */
  errors: Record<string, unknown>;
  loadingData: Record<string, Promise<void>>;
}

interface SubscriptionStoreDefintion
  extends StrictStoreDefinition<Subscriptions>, Internal {
  clearStartedTrial: (orgSlug: string) => void;
  get: (orgSlug: string, callback: GetCallback) => Promise<void>;
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
  errors: {},

  init() {
    this.api = new Client();
    this.state = {};
    this.loadingData = {};
    this.callbacks = {};
    this.errors = {};
  },

  set(orgSlug: string, data: Partial<Subscription>) {
    const subscription = {
      ...this.state[orgSlug]!,
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
      return Promise.resolve();
    }

    return this.loadData(orgSlug, callback);
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

  loadData(orgSlug: string, callback?: null | GetCallback, {markStartedTrial} = {}) {
    if (this.callbacks[orgSlug] === undefined) {
      this.callbacks[orgSlug] = [];
    }

    if (typeof callback === 'function') {
      this.callbacks[orgSlug].push(callback);
    }

    // Concurrent callers share the request so each one can see its outcome. A failed
    // load keeps its callbacks queued for the next successful load, so work such as
    // page-view tracking runs late instead of never.
    this.loadingData[orgSlug] ??= this.api
      .requestPromise(`/customers/${orgSlug}/`)
      .then(
        (data: Subscription) => {
          if (markStartedTrial) {
            data.isTrialStarted = true;
          }
          delete this.errors[orgSlug];
          this.set(orgSlug, data);
        },
        (error: unknown) => {
          this.errors[orgSlug] = error;
        }
      )
      .finally(() => {
        delete this.loadingData[orgSlug];
      });

    return this.loadingData[orgSlug];
  },
};

export const SubscriptionStore = createStore(subscriptionStoreConfig);
