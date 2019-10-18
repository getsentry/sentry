import {setActiveOrganization} from 'app/actionCreators/organizations';

import OrganizationActions from 'app/actions/organizationActions';
import TeamStore from 'app/stores/teamStore';
import ProjectsStore from 'app/stores/projectsStore';

/**
 * Fetches an organization's details with an option for the detailed representation
 * with teams and projects
 *
 * @param {Object} api A reference to the api client
 * @param {String} slug The organization slug
 * @param {boolean} detailed Whether or not the detailed org details should be
 *                           retrieved
 * @param {boolean} silent Should we silenty update the organization (do not
 *                         clear the current organization in the store)
 */
export async function fetchOrganizationDetails(api, slug, detailed, silent) {
  if (!silent) {
    OrganizationActions.fetchOrg();
  }

  try {
    const org = await api.requestPromise(`/organizations/${slug}/`, {
      query: {detailed: detailed ? 1 : 0},
    });

    if (!org) {
      OrganizationActions.fetchOrgError(new Error('retrieved organization is falsey'));
      return;
    }

    OrganizationActions.update(org);
    setActiveOrganization(org);

    if (detailed) {
      TeamStore.loadInitialData(org.teams);
      ProjectsStore.loadInitialData(org.projects);
    }
  } catch (err) {
    OrganizationActions.fetchOrgError(err);
  }
}
