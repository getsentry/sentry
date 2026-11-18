import {createStore} from 'zustand/vanilla';

import type {Organization} from 'sentry/types/organization';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {callSetOrganizationCallback} from 'sentry/utils/routeAnalytics/setOrganizationCallback';

// Errors that may occur during the fetching of organization details
export const ORGANIZATION_FETCH_ERROR_TYPES = {
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
  ORG_NO_ACCESS: 'ORG_NO_ACCESS',
  NO_ORGS: 'NO_ORGS',
} as const;

type OrganizationFetchErrorType =
  (typeof ORGANIZATION_FETCH_ERROR_TYPES)[keyof typeof ORGANIZATION_FETCH_ERROR_TYPES];

interface OrganizationState {
  readonly error: RequestError | null;
  readonly errorType: OrganizationFetchErrorType | null;
  readonly loading: boolean;
  readonly organization: Organization | null;
}

const initialState: OrganizationState = {
  loading: true,
  organization: null,
  error: null,
  errorType: null,
};

const store = createStore<OrganizationState>()(() => initialState);

function onUpdate(org: Organization, options?: {replace: true}): void;
function onUpdate(org: Partial<Organization>, options?: {replace?: false}): void;
function onUpdate(
  updatedOrg: Partial<Organization>,
  {replace = false}: {replace?: boolean} = {}
): void {
  const organization = (
    replace ? updatedOrg : {...store.getState().organization, ...updatedOrg}
  ) as Organization;

  store.setState(
    {
      loading: false,
      errorType: null,
      error: null,
      organization,
    },
    true
  );

  callSetOrganizationCallback(organization);
}

export const OrganizationStore = {
  // State is only written through the methods below.
  getState: store.getState,
  getInitialState: store.getInitialState,
  subscribe: store.subscribe,

  /**
   * Same as reset(). Kept for the tests that call it.
   */
  init(): void {
    OrganizationStore.reset();
  },

  reset(): void {
    store.setState(initialState, true);
  },

  onUpdate,

  onFetchOrgError(err: RequestError): void {
    let errorType: OrganizationState['errorType'] = null;

    switch (err.status) {
      case 401:
        errorType = ORGANIZATION_FETCH_ERROR_TYPES.ORG_NO_ACCESS;
        break;
      case 404:
        errorType = ORGANIZATION_FETCH_ERROR_TYPES.ORG_NOT_FOUND;
        break;
      default:
    }

    store.setState(
      {
        errorType,
        error: err,
        loading: false,
        organization: null,
      },
      true
    );
  },

  setNoOrganization(): void {
    store.setState({
      organization: null,
      errorType: ORGANIZATION_FETCH_ERROR_TYPES.NO_ORGS,
      loading: false,
    });
  },
};
