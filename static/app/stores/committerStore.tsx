import {createStore} from 'reflux';

import type {Committer, ReleaseCommitter} from 'sentry/types';

type State = {
  // Use `getCommitterStoreKey` to generate key
  [key: string]: {
    committers?: Committer[];
    committersError?: Error;
    committersLoading?: boolean;
    releaseCommitters?: ReleaseCommitter[];
  };
};

interface CommitterStoreDefinition extends Reflux.StoreDefinition {
  get(
    orgSlug: string,
    projectSlug: string,
    eventId: string
  ): {
    committers?: Committer[];
    committersError?: Error;
    committersLoading?: boolean;
  };
  getState(): State;

  init(): void;

  load(orgSlug: string, projectSlug: string, eventId: string): void;
  loadError(orgSlug: string, projectSlug: string, eventId: string, error: Error): void;
  loadSuccess(
    orgSlug: string,
    projectSlug: string,
    eventId: string,
    committers: Committer[],
    releaseCommitters?: ReleaseCommitter[]
  ): void;

  state: State;
}

export const storeConfig: CommitterStoreDefinition = {
  state: {},

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
  },

  reset() {
    this.state = {};
    this.trigger(this.state);
  },

  load(orgSlug: string, projectSlug: string, eventId: string) {
    const key = getCommitterStoreKey(orgSlug, projectSlug, eventId);
    this.state = {
      ...this.state,
      [key]: {
        committers: undefined,
        committersLoading: true,
        committersError: undefined,
      },
    };

    this.trigger(this.state);
  },

  loadError(orgSlug: string, projectSlug: string, eventId: string, err: Error) {
    const key = getCommitterStoreKey(orgSlug, projectSlug, eventId);
    this.state = {
      ...this.state,
      [key]: {
        committers: undefined,
        committersLoading: false,
        committersError: err,
      },
    };

    this.trigger(this.state);
  },

  loadSuccess(
    orgSlug: string,
    projectSlug: string,
    eventId: string,
    committers: Committer[],
    releaseCommitters?: ReleaseCommitter[]
  ) {
    const key = getCommitterStoreKey(orgSlug, projectSlug, eventId);
    this.state = {
      ...this.state,
      [key]: {
        committers,
        releaseCommitters,
        committersLoading: false,
        committersError: undefined,
      },
    };

    this.trigger(this.state);
  },

  get(orgSlug: string, projectSlug: string, eventId: string) {
    const key = getCommitterStoreKey(orgSlug, projectSlug, eventId);
    return {...this.state[key]};
  },

  getState() {
    return this.state;
  },
};

export function getCommitterStoreKey(
  orgSlug: string,
  projectSlug: string,
  eventId: string
): string {
  return `${orgSlug} ${projectSlug} ${eventId}`;
}

const CommitterStore = createStore(storeConfig);
export default CommitterStore;
