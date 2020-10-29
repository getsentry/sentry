import Reflux from 'reflux';

import {Organization} from 'app/types';
import OrganizationsActions from 'app/actions/organizationsActions';

type OrganizationsStoreInterface = {
  state: Organization[];
  loaded: boolean;

  onUpdate: (org: Organization) => void;
  onChangeSlug: (prev: Organization, next: Organization) => void;
  onRemoveSuccess: (slug: string) => void;
  get: (slug: string) => Organization | undefined;
  getAll: () => Organization[];
  remove: (slug: string) => void;
  add: (item: Organization) => void;
  load: (items: Organization[]) => void;
};

type OrganizationsStore = Reflux.Store & OrganizationsStoreInterface;

const organizationsStoreConfig: Reflux.StoreDefinition & OrganizationsStoreInterface = {
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

  onUpdate(org: Organization) {
    this.add(org);
  },

  onChangeSlug(prev: Organization, next: Organization) {
    if (prev.slug === next.slug) {
      return;
    }

    this.remove(prev.slug);
    this.add(next);
  },

  onRemoveSuccess(slug: string) {
    this.remove(slug);
  },

  get(slug: Organization['slug']) {
    return this.state.find((item: Organization) => item.slug === slug);
  },

  getAll() {
    return this.state;
  },

  remove(slug: Organization['slug']) {
    this.state = this.state.filter(item => slug !== item.slug);
    this.trigger(this.state);
  },

  add(item: Organization) {
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

export default Reflux.createStore(organizationsStoreConfig) as OrganizationsStore;
