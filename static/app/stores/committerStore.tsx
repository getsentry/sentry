import Reflux from 'reflux';

import CommitterActions from 'sentry/actions/committerActions';
import {Committer} from 'sentry/types';

type State = {
  // Use `getCommitterStoreKey` to generate key
  [key: string]: {
    committers?: Committer[];
    committersError?: Error;
    committersLoading?: boolean;
  };
};

type CommitterStoreInterface = {
  get(
    orgSlug: string,
    projectSlug: string,
    eventId: string
  ): {
    committers?: Committer[];
    committersError?: Error;
    committersLoading?: boolean;
  };

  load(orgSlug: string, projectSlug: string, eventId: string): void;
  loadError(orgSlug: string, projectSlug: string, eventId: string, error: Error): void;
  loadSuccess(
    orgSlug: string,
    projectSlug: string,
    eventId: string,
    data: Committer[]
  ): void;

  state: State;
};

export const storeConfig: Reflux.StoreDefinition & CommitterStoreInterface = {
  listenables: CommitterActions,
  state: {},

  init() {
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

  loadSuccess(orgSlug: string, projectSlug: string, eventId: string, data: Committer[]) {
    const key = getCommitterStoreKey(orgSlug, projectSlug, eventId);
    this.state = {
      ...this.state,
      [key]: {
        committers: data,
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
};

export function getCommitterStoreKey(
  orgSlug: string,
  projectSlug: string,
  eventId: string
): string {
  return `${orgSlug} ${projectSlug} ${eventId}`;
}

const CommitterStore = Reflux.createStore(storeConfig) as Reflux.Store &
  CommitterStoreInterface;

export default CommitterStore;
