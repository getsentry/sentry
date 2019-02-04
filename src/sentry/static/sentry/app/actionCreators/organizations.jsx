import {browserHistory} from 'react-router';

import {Client} from 'app/api';
import IndicatorStore from 'app/stores/indicatorStore';
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
    .then(data => {
      OrganizationsActions.removeSuccess(orgId);

      if (successMessage) {
        IndicatorStore.add(successMessage, 'success', {duration: 3000});
      }
    })
    .catch(err => {
      OrganizationsActions.removeError();

      if (errorMessage) {
        IndicatorStore.add(errorMessage, 'error', {duration: 3000});
      }
    });
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
}

export function fetchOrganizationByMember(memberId, {addOrg, fetchOrgDetails}) {
  const api = new Client();
  const request = api.requestPromise(`/organizations/?query=member_id:${memberId}`);

  request.then(data => {
    if (data.length) {
      if (addOrg) {
        // add org to SwitchOrganization dropdown
        OrganizationsStore.add(data[0]);
      }

      if (fetchOrgDetails) {
        // load SidebarDropdown with org details including `access`
        fetchOrganizationDetails(data[0].slug, {setActive: true, loadProjects: true});
      }
    }
  });

  return request;
}

export function fetchOrganizationDetails(orgId, {setActive, loadProjects, loadTeam}) {
  const api = new Client();
  const request = api.requestPromise(`/organizations/${orgId}/`);

  request.then(data => {
    if (setActive) {
      setActiveOrganization(data);
    }

    if (loadTeam) {
      TeamStore.loadInitialData(data.teams);
    }

    if (loadProjects) {
      ProjectsStore.loadInitialData(data.projects || []);
    }
  });

  return request;
}
