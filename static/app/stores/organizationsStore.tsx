import {Store} from '@tanstack/react-store';

import type {OrganizationSummary} from 'sentry/types/organization';

interface State {
  loaded: boolean;
  organizations: OrganizationSummary[];
}

const store = new Store<State>({organizations: [], loaded: false});

export const OrganizationsStore = {
  store,

  getState() {
    return store.state;
  },

  init() {
    store.setState(() => ({organizations: [], loaded: false}));
  },

  onUpdate(org: Partial<OrganizationSummary>) {
    let match = false;
    const newOrgs = [...store.state.organizations];
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
    store.setState(prev => ({...prev, organizations: newOrgs}));
  },

  onChangeSlug(prev: OrganizationSummary, next: Partial<OrganizationSummary>) {
    if (prev.slug === next.slug) {
      return;
    }

    OrganizationsStore.remove(prev.slug);
    OrganizationsStore.addOrReplace({...prev, ...next});
  },

  onRemoveSuccess(slug: string) {
    OrganizationsStore.remove(slug);
  },

  get(slug: string) {
    return store.state.organizations.find(item => item.slug === slug);
  },

  getAll() {
    return store.state.organizations;
  },

  remove(slug: string) {
    store.setState(prev => ({
      ...prev,
      organizations: store.state.organizations.filter(item => slug !== item.slug),
    }));
  },

  addOrReplace(item: OrganizationSummary) {
    let match = false;
    const newOrgs = [...store.state.organizations];
    newOrgs.forEach((existing, idx) => {
      if (existing.id === item.id) {
        newOrgs[idx] = {...existing, ...item};
        match = true;
      }
    });
    if (!match) {
      newOrgs.push(item);
    }
    store.setState(prev => ({...prev, organizations: newOrgs}));
  },

  load(items: OrganizationSummary[]) {
    store.setState(() => ({organizations: [...items], loaded: true}));
  },
};
