import Reflux from 'reflux';

import OrganizationActions from 'sentry/actions/organizationActions';
import {ORGANIZATION_FETCH_ERROR_TYPES} from 'sentry/constants';
import {Organization} from 'sentry/types';
import RequestError from 'sentry/utils/requestError/requestError';

import {CommonStoreInterface} from './types';

type UpdateOptions = {
  replace?: boolean;
};

type State = {
  dirty: boolean;
  loading: boolean;
  organization: Organization | null;
  error?: RequestError | null;
  errorType?: string | null;
};

type OrganizationStoreInterface = CommonStoreInterface<State> & {
  get(): State;
  init(): void;
  onFetchOrgError(err: RequestError): void;
  onUpdate(org: Organization, options: UpdateOptions): void;
  reset(): void;
};

const storeConfig: Reflux.StoreDefinition & OrganizationStoreInterface = {
  init() {
    this.reset();
    this.listenTo(OrganizationActions.update, this.onUpdate);
    this.listenTo(OrganizationActions.reset, this.reset);
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

  getState() {
    return this.get();
  },
};

const OrganizationStore = Reflux.createStore(storeConfig) as Reflux.Store &
  OrganizationStoreInterface;

export default OrganizationStore;
