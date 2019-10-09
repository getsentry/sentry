import OrganizationEnvironmentActions from 'app/actions/environmentActions';

/**
 * Fetches all environments for an organization
 *
 * @param {String} organizationSlug The organization slug
 */
export async function fetchOrganizationEnvironments(api, organizationSlug) {
  let environments;
  OrganizationEnvironmentActions.fetchEnvironments();
  try {
    environments = await api.requestPromise(
      `/organizations/${organizationSlug}/environments/`
    );
    OrganizationEnvironmentActions.fetchEnvironmentsSuccess(environments);
  } catch (err) {
    OrganizationEnvironmentActions.fetchEnvironmentsError(err);
  }
}
