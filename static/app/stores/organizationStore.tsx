import {Store} from '@tanstack/react-store';

import {ORGANIZATION_FETCH_ERROR_TYPES} from 'sentry/constants';
import type {Organization} from 'sentry/types/organization';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {callSetOrganizationCallback} from 'sentry/utils/routeAnalytics/setOrganizationCallback';

type State = {
  dirty: boolean;
  loading: boolean;
  organization: Organization | null;
  error?: RequestError | null;
  errorType?: string | null;
};

const initialState: State = {
  dirty: false,
  loading: true,
  organization: null,
  error: null,
  errorType: null,
};

const store = new Store<State>(initialState);

function onUpdate(org: Organization, options?: {replace: true}): void;
function onUpdate(org: Partial<Organization>, options?: {replace?: false}): void;
function onUpdate(updatedOrg: Partial<Organization>, {replace = false} = {}) {
  const organization = (
    replace ? updatedOrg : {...store.state.organization, ...updatedOrg}
  ) as Organization;
  store.setState(() => ({
    loading: false,
    dirty: false,
    errorType: null,
    error: null,
    organization,
  }));

  callSetOrganizationCallback(organization);
}

export const OrganizationStore = {
  store,

  getState() {
    return store.state;
  },

  init() {
    OrganizationStore.reset();
  },

  reset() {
    store.setState(() => initialState);
  },

  onUpdate,

  onFetchOrgError(err: RequestError) {
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
    store.setState(() => ({
      errorType,
      dirty: false,
      error: err,
      loading: false,
      organization: null,
    }));
  },

  setNoOrganization() {
    store.setState(prev => ({
      ...prev,
      organization: null,
      errorType: ORGANIZATION_FETCH_ERROR_TYPES.NO_ORGS,
      loading: false,
      dirty: false,
    }));
  },

  get() {
    return store.state;
  },
};
