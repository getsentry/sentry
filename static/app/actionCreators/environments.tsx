import {Client} from 'sentry/api';
import OrganizationEnvironmentsStore from 'sentry/stores/organizationEnvironmentsStore';

/**
 * Fetches all environments for an organization
 *
 * @param organizationSlug The organization slug
 */
export async function fetchOrganizationEnvironments(
  api: Client,
  organizationSlug: string
) {
  OrganizationEnvironmentsStore.onFetchEnvironments();
  try {
    const environments = await api.requestPromise(
      `/organizations/${organizationSlug}/environments/`
    );
    if (!environments) {
      OrganizationEnvironmentsStore.onFetchEnvironmentsError(
        new Error('retrieved environments is falsey')
      );
      return;
    }
    OrganizationEnvironmentsStore.onFetchEnvironmentsSuccess(environments);
  } catch (err) {
    OrganizationEnvironmentsStore.onFetchEnvironmentsError(err);
  }
}
