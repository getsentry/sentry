import {createStore} from 'reflux';

import type {Organization} from 'sentry/types/organization';

import type {CommonStoreDefinition} from './types';

interface State {
  loaded: boolean;
  organizations: Organization[];
}

interface OrganizationsStoreDefinition extends State, CommonStoreDefinition<State> {
  addOrReplace(item: Organization): void;
  get(slug: string): Organization | undefined;

  getAll(): Organization[];
  init(): void;
  load(items: Organization[]): void;
  onChangeSlug(prev: Organization, next: Partial<Organization>): void;
  onRemoveSuccess(slug: string): void;
  onUpdate(org: Partial<Organization>): void;
  remove(slug: string): void;
}

const storeConfig: OrganizationsStoreDefinition = {
  organizations: [],
  loaded: false,

  // So we can use Reflux.connect in a component mixin
  getInitialState() {
    return this.organizations;
  },

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.organizations = [];
    this.loaded = false;
  },

  onUpdate(org) {
    let match = false;
    this.organizations.forEach((existing, idx) => {
      if (existing.id === org.id) {
        this.organizations[idx] = {...existing, ...org};
        match = true;
      }
    });
    if (!match) {
      throw new Error(
        'Cannot update an organization that is not in the OrganizationsStore'
      );
    }
    this.trigger(this.organizations);
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
    return this.organizations.find((item: Organization) => item.slug === slug);
  },

  getAll() {
    return this.organizations;
  },

  getState() {
    return {organizations: this.organizations, loaded: this.loaded};
  },

  remove(slug) {
    this.organizations = this.organizations.filter(item => slug !== item.slug);
    this.trigger(this.organizations);
  },

  addOrReplace(item) {
    let match = false;
    this.organizations.forEach((existing, idx) => {
      if (existing.id === item.id) {
        this.organizations[idx] = {...existing, ...item};
        match = true;
      }
    });
    if (!match) {
      this.organizations = [...this.organizations, item];
    }
    this.trigger(this.organizations);
  },

  load(items: Organization[]) {
    this.organizations = items;
    this.loaded = true;
    this.trigger(items);
  },
};

const OrganizationsStore = createStore(storeConfig);
export default OrganizationsStore;
