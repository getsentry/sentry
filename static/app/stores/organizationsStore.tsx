import {createLegacyStore} from 'sentry/stores/createLegacyStore';
import type {OrganizationSummary} from 'sentry/types/organization';

interface State {
  loaded: boolean;
  organizations: OrganizationSummary[];
}

const store = createLegacyStore<State>(() => ({organizations: [], loaded: false}));

export const OrganizationsStore = {
  ...store,

  init() {
    store.resetState({organizations: [], loaded: false});
  },

  onUpdate(org: Partial<OrganizationSummary>) {
    let match = false;
    const newOrgs = [...store.getState().organizations];
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
    store.setState({organizations: newOrgs});
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
    return store.getState().organizations.find(item => item.slug === slug);
  },

  getAll() {
    return store.getState().organizations;
  },

  remove(slug: string) {
    store.setState({
      organizations: store.getState().organizations.filter(item => slug !== item.slug),
    });
  },

  addOrReplace(item: OrganizationSummary) {
    let match = false;
    const newOrgs = [...store.getState().organizations];
    newOrgs.forEach((existing, idx) => {
      if (existing.id === item.id) {
        newOrgs[idx] = {...existing, ...item};
        match = true;
      }
    });
    if (!match) {
      newOrgs.push(item);
    }
    store.setState({organizations: newOrgs});
  },

  load(items: OrganizationSummary[]) {
    store.setState({organizations: [...items], loaded: true}, true);
  },
};
