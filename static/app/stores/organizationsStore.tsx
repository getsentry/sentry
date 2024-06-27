import {createStore} from 'reflux';

import type {Organization} from 'sentry/types/organization';

import type {StrictStoreDefinition} from './types';

interface State {
  loaded: boolean;
  organizations: Organization[];
}

interface OrganizationsStoreDefinition extends StrictStoreDefinition<State> {
  addOrReplace(item: Organization): void;
  get(slug: string): Organization | undefined;
  getAll(): Organization[];
  load(items: Organization[]): void;
  onChangeSlug(prev: Organization, next: Partial<Organization>): void;
  onRemoveSuccess(slug: string): void;
  onUpdate(org: Partial<Organization>): void;
  remove(slug: string): void;
}

const storeConfig: OrganizationsStoreDefinition = {
  state: {organizations: [], loaded: false},

  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.state = {organizations: [], loaded: false};
  },

  onUpdate(org) {
    let match = false;
    const newOrgs = [...this.state.organizations];
    newOrgs.forEach((existing, idx) => {
      if (existing.id === org.id) {
        newOrgs[idx] = {...existing, ...org};
        match = true;
      }
    });
    if (!match) {
      throw new Error(
        'Cannot update an organization that is not in the OrganizationsStore'
      );
    }
    this.state = {...this.state, organizations: newOrgs};
    this.trigger(newOrgs);
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
    return this.state.organizations.find((item: Organization) => item.slug === slug);
  },

  getAll() {
    return this.state.organizations;
  },

  getState() {
    return this.state;
  },

  remove(slug) {
    this.state = {
      ...this.state,
      organizations: this.state.organizations.filter(item => slug !== item.slug),
    };
    this.trigger(this.state.organizations);
  },

  addOrReplace(item) {
    let match = false;
    const newOrgs = [...this.state.organizations];
    newOrgs.forEach((existing, idx) => {
      if (existing.id === item.id) {
        newOrgs[idx] = {...existing, ...item};
        match = true;
      }
    });
    if (!match) {
      newOrgs.push(item);
    }
    this.state = {...this.state, organizations: newOrgs};
    this.trigger(newOrgs);
  },

  load(items: Organization[]) {
    const newOrgs = [...items];
    this.state = {organizations: newOrgs, loaded: true};
    this.trigger(newOrgs);
  },
};

const OrganizationsStore = createStore(storeConfig);
export default OrganizationsStore;
