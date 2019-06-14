/**
 * Fetches all environments for an organization
 *
 * @param {String} organizationSlug The organization slug
 */
export function fetchOrganizationEnvironments(api, organizationSlug) {
  return api.requestPromise(`/organizations/${organizationSlug}/environments/`);
}
