import {createStore} from 'reflux';

import {ORGANIZATION_FETCH_ERROR_TYPES} from 'sentry/constants';
import type {Organization} from 'sentry/types/organization';
import type RequestError from 'sentry/utils/requestError/requestError';

import HookStore from './hookStore';
import LatestContextStore from './latestContextStore';
import type {StrictStoreDefinition} from './types';

type State = {
  dirty: boolean;
  loading: boolean;
  organization: Organization | null;
  error?: RequestError | null;
  errorType?: string | null;
};

interface OrganizationStoreDefinition extends StrictStoreDefinition<State> {
  get(): State;
  onFetchOrgError(err: RequestError): void;
  onUpdate(org: Organization, options?: {replace: true}): void;
  onUpdate(org: Partial<Organization>, options?: {replace?: false}): void;
  reset(): void;
  setNoOrganization(): void;
}

const storeConfig: OrganizationStoreDefinition = {
  state: {
    dirty: false,
    loading: true,
    organization: null,
    error: null,
    errorType: null,
  },
  init() {
    // XXX: Do not use `this.listenTo` in this store. We avoid usage of reflux
    // listeners due to their leaky nature in tests.

    this.reset();
  },

  reset() {
    this.state = {
      dirty: false,
      loading: true,
      organization: null,
      error: null,
      errorType: null,
    };
    this.trigger(this.get());
  },

  onUpdate(updatedOrg: Organization, {replace = false} = {}) {
    const organization = replace
      ? updatedOrg
      : {...this.state.organization, ...updatedOrg};
    this.state = {
      loading: false,
      dirty: false,
      errorType: null,
      error: null,
      organization,
    };
    this.trigger(this.get());

    LatestContextStore.onUpdateOrganization(organization);
    HookStore.getCallback(
      'react-hook:route-activated',
      'setOrganization'
    )?.(organization);
  },

  onFetchOrgError(err) {
    let errorType: State['errorType'] = null;

    switch (err?.status) {
      case 401:
        errorType = ORGANIZATION_FETCH_ERROR_TYPES.ORG_NO_ACCESS;
        break;
      case 404:
        errorType = ORGANIZATION_FETCH_ERROR_TYPES.ORG_NOT_FOUND;
        break;
      default:
    }
    this.state = {
      errorType,
      dirty: false,
      error: err,
      loading: false,
      organization: null,
    };
    this.trigger(this.get());
  },

  setNoOrganization() {
    this.state = {
      ...this.state,
      organization: null,
      errorType: ORGANIZATION_FETCH_ERROR_TYPES.NO_ORGS,
      loading: false,
      dirty: false,
    };
    this.trigger(this.get());
  },

  get() {
    return this.state;
  },

  getState() {
    return this.state;
  },
};

const OrganizationStore = createStore(storeConfig);
export default OrganizationStore;
