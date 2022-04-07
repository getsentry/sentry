import {createStore, StoreDefinition} from 'reflux';

import {User} from 'sentry/types';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

interface MemberListStoreDefinition extends StoreDefinition {
  getAll(): User[];
  getByEmail(email: string): User | undefined;
  getById(id: string): User | undefined;
  init(): void;
  isLoaded(): boolean;
  loadInitialData(items: User[]): void;
  loaded: boolean;
  state: User[];
}

const storeConfig: MemberListStoreDefinition = {
  // listenables: MemberActions,

  loaded: false,
  state: [],

  init() {
    this.state = [];
    this.loaded = false;
  },

  // TODO(dcramer): this should actually come from an action of some sorts
  loadInitialData(items: User[]) {
    this.state = items;
    this.loaded = true;
    this.trigger(this.state, 'initial');
  },

  isLoaded() {
    return this.loaded;
  },

  getById(id) {
    if (!this.state) {
      return undefined;
    }

    id = '' + id;
    for (let i = 0; i < this.state.length; i++) {
      if (this.state[i].id === id) {
        return this.state[i];
      }
    }
    return undefined;
  },

  getByEmail(email) {
    if (!this.state) {
      return undefined;
    }

    email = email.toLowerCase();
    for (let i = 0; i < this.state.length; i++) {
      if (this.state[i].email.toLowerCase() === email) {
        return this.state[i];
      }
    }
    return undefined;
  },

  getAll() {
    return this.state;
  },
};

const MemberListStore = createStore(makeSafeRefluxStore(storeConfig));
export default MemberListStore;
