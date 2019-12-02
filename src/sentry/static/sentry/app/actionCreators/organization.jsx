import {setActiveOrganization} from 'app/actionCreators/organizations';

import {Client} from 'app/api';
import OrganizationActions from 'app/actions/organizationActions';
import ProjectActions from 'app/actions/projectActions';
import ProjectsStore from 'app/stores/projectsStore';
import TeamActions from 'app/actions/teamActions';
import TeamStore from 'app/stores/teamStore';
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
      // TODO(davidenwang): Change these to actions after organization.projects
      // and organization.teams no longer exists. Currently if they were changed
      // to actions it would cause OrganizationContext to rerender many times
      TeamStore.loadInitialData(org.teams);
      ProjectsStore.loadInitialData(org.projects);
    } else {
      // create a new client so the request is not cancelled
      const uncancelableApi = new Client();
      const [projects, teams] = await Promise.all([
        uncancelableApi.requestPromise(`/organizations/${slug}/projects/`, {
          query: {
            all_projects: 1,
          },
        }),
        uncancelableApi.requestPromise(`/organizations/${slug}/teams/`),
      ]);
      ProjectActions.loadProjects(projects);
      TeamActions.loadTeams(teams);
    }
  } catch (err) {
    OrganizationActions.fetchOrgError(err);
  }
}
