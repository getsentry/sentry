import EnvironmentActions from 'app/actions/environmentActions';
import {Client} from 'app/api';

/**
 * Fetches all environments for an organization
 *
 * @param organizationSlug The organization slug
 */
export async function fetchOrganizationEnvironments(
  api: Client,
  organizationSlug: string
) {
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
