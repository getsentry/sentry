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
    if (!environments) {
      EnvironmentActions.fetchEnvironmentsError(
        new Error('retrieved environments is falsey')
      );
      return;
    }
    EnvironmentActions.fetchEnvironmentsSuccess(environments);
  } catch (err) {
    EnvironmentActions.fetchEnvironmentsError(err);
  }
}
