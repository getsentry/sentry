import {createStore} from 'zustand/vanilla';

import type {OrganizationSummary} from 'sentry/types/organization';

interface OrganizationsState {
  readonly loaded: boolean;
  readonly organizations: readonly OrganizationSummary[];
}

const initialState: OrganizationsState = {organizations: [], loaded: false};

const store = createStore<OrganizationsState>()(() => initialState);

export const OrganizationsStore = {
  // State is only written through the methods below.
  getState: store.getState,
  getInitialState: store.getInitialState,
  subscribe: store.subscribe,

  /**
   * Empties the store. Only used to reset state between tests.
   */
  init(): void {
    store.setState(initialState, true);
  },

  onUpdate(org: Partial<OrganizationSummary>): void {
    let match = false;
    const newOrgs = store.getState().organizations.map(existing => {
      if (existing.id === org.id) {
        match = true;
        return {...existing, ...org};
      }
      return existing;
    });
    if (!match) {
      throw new Error(
        'Cannot update an organization that is not in the OrganizationsStore'
      );
    }
    store.setState({organizations: newOrgs});
  },

  onChangeSlug(prev: OrganizationSummary, next: Partial<OrganizationSummary>): void {
    if (prev.slug === next.slug) {
      return;
    }

    OrganizationsStore.remove(prev.slug);
    OrganizationsStore.addOrReplace({...prev, ...next});
  },

  onRemoveSuccess(slug: string): void {
    OrganizationsStore.remove(slug);
  },

  get(slug: string): OrganizationSummary | undefined {
    return store.getState().organizations.find(item => item.slug === slug);
  },

  getAll(): readonly OrganizationSummary[] {
    return store.getState().organizations;
  },

  remove(slug: string): void {
    store.setState(state => ({
      organizations: state.organizations.filter(item => slug !== item.slug),
    }));
  },

  addOrReplace(item: OrganizationSummary): void {
    let match = false;
    const newOrgs = store.getState().organizations.map(existing => {
      if (existing.id === item.id) {
        match = true;
        return {...existing, ...item};
      }
      return existing;
    });
    if (!match) {
      newOrgs.push(item);
    }
    store.setState({organizations: newOrgs});
  },

  load(items: readonly OrganizationSummary[]): void {
    store.setState({organizations: [...items], loaded: true}, true);
  },
};
