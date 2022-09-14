import {createStore, StoreDefinition} from 'reflux';

import OrganizationsActions from 'sentry/actions/organizationsActions';
import {Organization} from 'sentry/types';
import {makeSafeRefluxStore} from 'sentry/utils/makeSafeRefluxStore';

interface OrganizationsStoreDefinition extends StoreDefinition {
  add(item: Organization): void;
  get(slug: string): Organization | undefined;

  getAll(): Organization[];
  getState(): Organization[];
  load(items: Organization[]): void;
  loaded: boolean;
  onChangeSlug(prev: Organization, next: Organization): void;
  onRemoveSuccess(slug: string): void;
  onUpdate(org: Organization): void;
  remove(slug: string): void;
  state: Organization[];
}

const storeConfig: OrganizationsStoreDefinition = {
  listenables: [OrganizationsActions],

  state: [],
  loaded: false,

  // So we can use Reflux.connect in a component mixin
  getInitialState() {
    return this.state;
  },

  init() {
    this.state = [];
    this.loaded = false;
  },

  onUpdate(org) {
    this.add(org);
  },

  onChangeSlug(prev, next) {
    if (prev.slug === next.slug) {
      return;
    }

    this.remove(prev.slug);
    this.add(next);
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

  add(item) {
    let match = false;
    this.state.forEach((existing, idx) => {
      if (existing.id === item.id) {
        item = {...existing, ...item};
        this.state[idx] = item;
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

const OrganizationsStore = createStore(makeSafeRefluxStore(storeConfig));

export default OrganizationsStore;
