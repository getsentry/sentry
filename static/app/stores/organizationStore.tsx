import Reflux from 'reflux';

import OrganizationActions from 'app/actions/organizationActions';
import {ORGANIZATION_FETCH_ERROR_TYPES} from 'app/constants';
import {Organization} from 'app/types';
import RequestError from 'app/utils/requestError/requestError';

type UpdateOptions = {
  replace?: boolean;
};

type State = {
  organization: Organization | null;
  loading: boolean;
  dirty: boolean;
  errorType?: string | null;
  error?: RequestError | null;
};

type OrganizationStoreInterface = {
  init: () => void;
  reset: () => void;
  onUpdate: (org: Organization, options: UpdateOptions) => void;
  onFetchOrgError: (err: RequestError) => void;
  get: () => State;
};

const storeConfig: Reflux.StoreDefinition & OrganizationStoreInterface = {
  init() {
    this.reset();
    this.listenTo(OrganizationActions.update, this.onUpdate);
    this.listenTo(OrganizationActions.fetchOrg, this.reset);
    this.listenTo(OrganizationActions.fetchOrgError, this.onFetchOrgError);
  },

  reset() {
    this.loading = true;
    this.error = null;
    this.errorType = null;
    this.organization = null;
    this.dirty = false;
    this.trigger(this.get());
  },

  onUpdate(updatedOrg: Organization, {replace = false}: UpdateOptions = {}) {
    this.loading = false;
    this.error = null;
    this.errorType = null;
    this.organization = replace ? updatedOrg : {...this.organization, ...updatedOrg};
    this.dirty = false;
    this.trigger(this.get());
  },

  onFetchOrgError(err: RequestError) {
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
};

const OrganizationStore = Reflux.createStore(storeConfig) as Reflux.Store &
  OrganizationStoreInterface;

export default OrganizationStore;
