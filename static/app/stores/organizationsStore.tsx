import {createStore, StoreDefinition} from 'reflux';

import {Organization} from 'sentry/types';

interface OrganizationsStoreDefinition extends StoreDefinition {
  addOrReplace(item: Organization): void;
  get(slug: string): Organization | undefined;

  getAll(): Organization[];
  getState(): Organization[];
  init(): void;
  load(items: Organization[]): void;
  loaded: boolean;
  onChangeSlug(prev: Organization, next: Partial<Organization>): void;
  onRemoveSuccess(slug: string): void;
  onUpdate(org: Partial<Organization>): void;
  remove(slug: string): void;
  state: Organization[];
}

const storeConfig: OrganizationsStoreDefinition = {
  state: [],
  loaded: false,

  // So we can use Reflux.connect in a component mixin
  getInitialState() {
    return this.state;
  },

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.state = [];
    this.loaded = false;
  },

  onUpdate(org) {
    let match = false;
    this.state.forEach((existing, idx) => {
      if (existing.id === org.id) {
        this.state[idx] = {...existing, ...org};
        match = true;
      }
    });
    if (!match) {
      throw new Error(
        'Cannot update an organization that is not in the OrganizationsStore'
      );
    }
    this.trigger(this.state);
  },

  onChangeSlug(prev, next) {
    if (prev.slug === next.slug) {
      return;
    }

    this.remove(prev.slug);
    this.addOrReplace({...prev, ...next});
  },

  onRemoveSuccess(slug) {
    this.remove(slug);
  },

  get(slug) {
    return this.state.find((item: Organization) => item.slug === slug);
  },

  getAll() {
    return this.state;
  },

  getState() {
    return this.state;
  },

  remove(slug) {
    this.state = this.state.filter(item => slug !== item.slug);
    this.trigger(this.state);
  },

  addOrReplace(item) {
    let match = false;
    this.state.forEach((existing, idx) => {
      if (existing.id === item.id) {
        this.state[idx] = {...existing, ...item};
        match = true;
      }
    });
    if (!match) {
      this.state = [...this.state, item];
    }
    this.trigger(this.state);
  },

  load(items: Organization[]) {
    this.state = items;
    this.loaded = true;
    this.trigger(items);
  },
};

const OrganizationsStore = createStore(storeConfig);
export default OrganizationsStore;
