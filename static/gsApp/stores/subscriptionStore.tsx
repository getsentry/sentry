import * as Sentry from '@sentry/react';
import {createStore} from 'zustand/vanilla';

import {Client} from 'sentry/api';
import {RequestError} from 'sentry/utils/requestError/requestError';

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

export const SubscriptionStore = {
  // State is only written through the methods below.
  getState: store.getState,
  getInitialState: store.getInitialState,
  subscribe: store.subscribe,

  api: new Client(),
  callbacks: {} as Record<string, GetCallback[]>,

  /**
   * The error from the most recent failed load, cleared by the next successful one.
   */
  errors: {} as Record<string, unknown>,
  loadingData: {} as Record<string, Promise<void>>,

  /**
   * Empties the store. Only used to reset state between tests.
   */
  init(): void {
    SubscriptionStore.api = new Client();
    SubscriptionStore.errors = {};
    SubscriptionStore.loadingData = {};
    SubscriptionStore.callbacks = {};
    store.setState({}, true);
  },

  set(orgSlug: string, data: Subscription): void {
    const subscription: Subscription = {
      ...store.getState()[orgSlug],
      ...data,
      setAt: Date.now(), // Refetch usage data if Subscription is updated
    };

    store.setState({[orgSlug]: subscription});

    if (SubscriptionStore.callbacks[orgSlug]) {
      SubscriptionStore.callbacks[orgSlug].forEach(cb => cb(subscription));
      delete SubscriptionStore.callbacks[orgSlug];
    }
  },

  /**
   * Merges fields into an already loaded subscription. Does nothing when the
   * subscription has not loaded, so a partial object is never stored as one.
   */
  update(orgSlug: string, data: Partial<Subscription>): void {
    const current = store.getState()[orgSlug];
    if (!current) {
      return;
    }
    SubscriptionStore.set(orgSlug, {...current, ...data});
  },

  get(orgSlug: string, callback: GetCallback): Promise<void> {
    const subscription = store.getState()[orgSlug];
    if (subscription) {
      callback(subscription);
      return Promise.resolve();
    }

    // Keep this callback queued through failed loads, so work such as page-view
    // tracking runs late instead of never.
    (SubscriptionStore.callbacks[orgSlug] ??= []).push(callback);
    return SubscriptionStore.loadData(orgSlug);
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

  loadData(
    orgSlug: string,
    callback?: null | GetCallback,
    {markStartedTrial}: LoadOptions = {}
  ): Promise<void> {
    // Concurrent callers share the request so each one can see its outcome.
    SubscriptionStore.loadingData[orgSlug] ??= SubscriptionStore.api
      .requestPromise(`/customers/${orgSlug}/`)
      .then((data: Subscription | '' | null) => {
        // The endpoint can answer 200 with an empty body when serialization fails.
        if (!data) {
          throw new Error('Empty subscription response');
        }
        return data;
      })
      .then(
        data => {
          if (markStartedTrial) {
            data.isTrialStarted = true;
          }
          delete SubscriptionStore.errors[orgSlug];
          SubscriptionStore.set(orgSlug, data);
        },
        (error: unknown) => {
          // Report the first failure only, not each retry until a load succeeds.
          if (
            SubscriptionStore.errors[orgSlug] === undefined &&
            isUnseenByBackend(error)
          ) {
            Sentry.captureException(error);
          }
          SubscriptionStore.errors[orgSlug] = error;
        }
      )
      .finally(() => {
        delete SubscriptionStore.loadingData[orgSlug];
      });

    const load = SubscriptionStore.loadingData[orgSlug];
    if (typeof callback !== 'function') {
      return load;
    }

    // A callback passed here follows an action, such as an upgrade. Run it only if
    // this load succeeds, so a later load does not repeat the action's success UI.
    return load.then(() => {
      const subscription = store.getState()[orgSlug];
      if (SubscriptionStore.errors[orgSlug] === undefined && subscription) {
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
