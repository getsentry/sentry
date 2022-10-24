import {createStore, StoreDefinition} from 'reflux';

import {User} from 'sentry/types';

interface MemberListStoreDefinition extends StoreDefinition {
  getAll(): User[];
  getById(id: string): User | undefined;
  getState(): User[];
  init(): void;
  isLoaded(): boolean;
  loadInitialData(items: User[]): void;
  loaded: boolean;
  state: User[];
}

const storeConfig: MemberListStoreDefinition = {
  loaded: false,
  state: [],

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

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

  getAll() {
    return this.state;
  },

  getState() {
    return this.state;
  },
};

const MemberListStore = createStore(storeConfig);
export default MemberListStore;
