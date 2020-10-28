import Reflux from 'reflux';

import {User} from 'app/types';

type MemberListStoreInterface = {
  state: User[];
  loaded: boolean;
  loadInitialData: (items: User[]) => void;
  isLoaded: () => boolean;
  getById: (id: string) => User | undefined;
  getByEmail: (email: string) => User | undefined;
  getAll: () => User[];
};

const memberListStoreConfig: Reflux.StoreDefinition & MemberListStoreInterface = {
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

type MemberListStore = Reflux.Store & MemberListStoreInterface;

export default Reflux.createStore(memberListStoreConfig) as MemberListStore;
