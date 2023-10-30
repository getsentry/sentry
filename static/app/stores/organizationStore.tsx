import {createStore} from 'reflux';

import {ORGANIZATION_FETCH_ERROR_TYPES} from 'sentry/constants';
import {Organization} from 'sentry/types';
import RequestError from 'sentry/utils/requestError/requestError';

import HookStore from './hookStore';
import LatestContextStore from './latestContextStore';
import ReleaseStore from './releaseStore';
import {CommonStoreDefinition} from './types';

type State = {
  dirty: boolean;
  loading: boolean;
  organization: Organization | null;
  error?: RequestError | null;
  errorType?: string | null;
};

interface OrganizationStoreDefinition extends CommonStoreDefinition<State> {
  get(): State;
  init(): void;
  onFetchOrgError(err: RequestError): void;
  onUpdate(org: Organization, options?: {replace: true}): void;
  onUpdate(org: Partial<Organization>, options?: {replace?: false}): void;
  reset(): void;
}

const storeConfig: OrganizationStoreDefinition = {
  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
  },

  reset() {
    this.loading = true;
    this.error = null;
    this.errorType = null;
    this.organization = null;
    this.dirty = false;
    this.trigger(this.get());
  },

  onUpdate(updatedOrg: Organization, {replace = false} = {}) {
    this.loading = false;
    this.error = null;
    this.errorType = null;
    this.organization = replace ? updatedOrg : {...this.organization, ...updatedOrg};
    this.dirty = false;
    this.trigger(this.get());

    ReleaseStore.updateOrganization(this.organization);
    LatestContextStore.onUpdateOrganization(this.organization);
    HookStore.getCallback(
      'react-hook:route-activated',
      'setOrganization'
    )?.(this.organization);
  },

  onFetchOrgError(err) {
    this.organization = null;
    this.errorType = null;

    switch (err?.status) {
      case 401:
        this.errorType = ORGANIZATION_FETCH_ERROR_TYPES.ORG_NO_ACCESS;
        break;
      case 404:
        this.errorType = ORGANIZATION_FETCH_ERROR_TYPES.ORG_NOT_FOUND;
        break;
      default:
    }
    this.loading = false;
    this.error = err;
    this.dirty = false;
    this.trigger(this.get());
  },

  get() {
    return {
      organization: this.organization,
      error: this.error,
      loading: this.loading,
      errorType: this.errorType,
      dirty: this.dirty,
    };
  },

  getState() {
    return this.get();
  },
};

const OrganizationStore = createStore(storeConfig);
export default OrganizationStore;
