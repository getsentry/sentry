import * as Sentry from '@sentry/react';
import {createStore} from 'reflux';

import {Client} from 'sentry/api';
import type {StrictStoreDefinition} from 'sentry/stores/types';
import {RequestError} from 'sentry/utils/requestError/requestError';

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

    // Keep this callback queued through failed loads, so work such as page-view
    // tracking runs late instead of never.
    (this.callbacks[orgSlug] ??= []).push(callback);
    return this.loadData(orgSlug);
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
    // Concurrent callers share the request so each one can see its outcome.
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
          // Report the first failure only, not each retry until a load succeeds.
          if (this.errors[orgSlug] === undefined && isUnseenByBackend(error)) {
            Sentry.captureException(error);
          }
          this.errors[orgSlug] = error;
        }
      )
      .finally(() => {
        delete this.loadingData[orgSlug];
      });

    const load = this.loadingData[orgSlug];
    if (typeof callback !== 'function') {
      return load;
    }

    // A callback passed here follows an action, such as an upgrade. Run it only if
    // this load succeeds, so a later load does not repeat the action's success UI.
    return load.then(() => {
      const subscription = this.state[orgSlug];
      if (this.errors[orgSlug] === undefined && subscription) {
        callback(subscription);
      }
    });
  },
};

// The backend reports its own errors, so report only failures it cannot see: the
// request never reached it (no status), or a gateway in front of it failed.
function isUnseenByBackend(error: unknown) {
  if (!(error instanceof RequestError)) {
    return true;
  }
  const {status} = error;
  return status === undefined || status === 0 || (status >= 502 && status <= 504);
}

export const SubscriptionStore = createStore(subscriptionStoreConfig);
