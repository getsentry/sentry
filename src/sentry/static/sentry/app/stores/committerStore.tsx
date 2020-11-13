import Reflux from 'reflux';

import CommitterActions from 'app/actions/committerActions';
import {Committer} from 'app/types';

type CommitterStoreInterface = {
  state: {
    // Use `getCommitterStoreKey` to generate key
    [key: string]: {
      committers?: Committer[];
      committersLoading?: boolean;
      committersError?: Error;
    };
  };

  load(orgSlug: string, projectSlug: string, eventId: string): void;
  loadSuccess(
    orgSlug: string,
    projectSlug: string,
    eventId: string,
    data: Committer[]
  ): void;
  loadError(orgSlug: string, projectSlug: string, eventId: string, error: Error): void;

  get(
    orgSlug: string,
    projectSlug: string,
    eventId: string
  ): {
    committers?: Committer[];
    committersLoading?: boolean;
    committersError?: Error;
  };
};

export const CommitterStoreConfig: Reflux.StoreDefinition & CommitterStoreInterface = {
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

type CommitterStore = Reflux.Store & CommitterStoreInterface;
export default Reflux.createStore(CommitterStoreConfig) as CommitterStore;
