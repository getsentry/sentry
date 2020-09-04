import {browserHistory} from 'react-router';

import {Client} from 'app/api';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {resetGlobalSelection} from 'app/actionCreators/globalSelection';
import OrganizationActions from 'app/actions/organizationActions';
import OrganizationsActions from 'app/actions/organizationsActions';
import OrganizationsStore from 'app/stores/organizationsStore';
import ProjectsStore from 'app/stores/projectsStore';
import TeamStore from 'app/stores/teamStore';

export function redirectToRemainingOrganization({orgId, removeOrg}) {
  // Remove queued, should redirect
  const allOrgs = OrganizationsStore.getAll().filter(
    org => org.status.id === 'active' && org.slug !== orgId
  );
  if (!allOrgs.length) {
    browserHistory.push('/organizations/new/');
    return;
  }

  // Let's be smart and select the best org to redirect to
  const firstRemainingOrg = allOrgs[0];
  browserHistory.push(`/${firstRemainingOrg.slug}/`);

  // Remove org from SidebarDropdown
  if (removeOrg) {
    OrganizationsStore.remove(orgId);
  }
}

export function remove(api, {successMessage, errorMessage, orgId} = {}) {
  const endpoint = `/organizations/${orgId}/`;
  return api
    .requestPromise(endpoint, {
      method: 'DELETE',
    })
    .then(() => {
      OrganizationsActions.removeSuccess(orgId);

      if (successMessage) {
        addSuccessMessage(successMessage);
      }
    })
    .catch(() => {
      OrganizationsActions.removeError();

      if (errorMessage) {
        addErrorMessage(errorMessage);
      }
    });
}

export function switchOrganization() {
  resetGlobalSelection();
}

export function removeAndRedirectToRemainingOrganization(api, params) {
  remove(api, params).then(() => redirectToRemainingOrganization(params));
}

export function setActiveOrganization(org) {
  OrganizationsActions.setActive(org);
}

export function changeOrganizationSlug(prev, next) {
  OrganizationsActions.changeSlug(prev, next);
}

export function updateOrganization(org) {
  OrganizationsActions.update(org);
  OrganizationActions.update(org);
}

export async function fetchOrganizationByMember(memberId, {addOrg, fetchOrgDetails}) {
  const api = new Client();
  const data = await api.requestPromise(`/organizations/?query=member_id:${memberId}`);

  if (!data.length) {
    return null;
  }

  const org = data[0];

  if (addOrg) {
    // add org to SwitchOrganization dropdown
    OrganizationsStore.add(org);
  }

  if (fetchOrgDetails) {
    // load SidebarDropdown with org details including `access`
    await fetchOrganizationDetails(org.slug, {setActive: true, loadProjects: true});
  }

  return org;
}

export async function fetchOrganizationDetails(
  orgId,
  {setActive, loadProjects, loadTeam}
) {
  const api = new Client();
  const data = await api.requestPromise(`/organizations/${orgId}/`);

  if (setActive) {
    setActiveOrganization(data);
  }

  if (loadTeam) {
    TeamStore.loadInitialData(data.teams);
  }

  if (loadProjects) {
    ProjectsStore.loadInitialData(data.projects || []);
  }

  return data;
}
