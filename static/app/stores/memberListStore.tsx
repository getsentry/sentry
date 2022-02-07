import Reflux from 'reflux';

import {User} from 'sentry/types';

type MemberListStoreInterface = {
  getAll(): User[];
  getByEmail(email: string): User | undefined;
  getById(id: string): User | undefined;
  isLoaded(): boolean;
  loadInitialData(items: User[]): void;
  loaded: boolean;
  state: User[];
};

const storeConfig: Reflux.StoreDefinition & MemberListStoreInterface = {
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

const MemberListStore = Reflux.createStore(storeConfig) as Reflux.Store &
  MemberListStoreInterface;

export default MemberListStore;
