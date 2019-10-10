import EnvironmentActions from 'app/actions/environmentActions';

/**
 * Fetches all environments for an organization
 *
 * @param {String} organizationSlug The organization slug
 */
export async function fetchOrganizationEnvironments(api, organizationSlug) {
  let environments;
  EnvironmentActions.fetchEnvironments();
  try {
    environments = await api.requestPromise(
      `/organizations/${organizationSlug}/environments/`
    );
    EnvironmentActions.fetchEnvironmentsSuccess(environments);
  } catch (err) {
    EnvironmentActions.fetchEnvironmentsError(err);
  }
}
