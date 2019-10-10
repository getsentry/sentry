import EnvironmentActions from 'app/actions/environmentActions';

/**
 * Fetches all environments for an organization
 *
 * @param {String} organizationSlug The organization slug
 */
export async function fetchOrganizationEnvironments(api, organizationSlug) {
  EnvironmentActions.fetchEnvironments();
  try {
    const environments = await api.requestPromise(
      `/organizations/${organizationSlug}/environments/`
    );
    EnvironmentActions.fetchEnvironmentsSuccess(environments);
  } catch (err) {
    EnvironmentActions.fetchEnvironmentsError(err);
  }
}
