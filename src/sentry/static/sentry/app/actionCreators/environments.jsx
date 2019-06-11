import EnvironmentActions from 'app/actions/environmentActions';

export function loadEnvironments(data, envName) {
  EnvironmentActions.loadData(data, envName);
}

export function loadActiveEnvironments(data) {
  EnvironmentActions.loadActiveData(data);
}

export function loadHiddenEnvironments(data) {
  EnvironmentActions.loadHiddenData(data);
}

/**
 * Fetches all environments for an organization
 *
 * @param {String} organizationSlug The organization slug
 */
export function fetchOrganizationEnvironments(api, organizationSlug) {
  return api.requestPromise(`/organizations/${organizationSlug}/environments/`);
}
