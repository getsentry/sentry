import {browserHistory} from 'react-router';

import {Client} from '../api';
import IndicatorStore from '../stores/indicatorStore';
import OrganizationsActions from '../actions/organizationsActions';
import OrganizationsStore from '../stores/organizationsStore';
import ProjectsStore from '../stores/projectsStore';
import TeamStore from '../stores/teamStore';

export function redirectToRemainingOrganization({orgId}) {
  // Remove queued, should redirect
  let allOrgs = OrganizationsStore.getAll().filter(org => org.slug !== orgId);
  if (!allOrgs.length) {
    // This is bad...
    return;
  }

  // Let's be smart and select the best org to redirect to
  let firstRemainingOrg = allOrgs[0];
  browserHistory.push(`/${firstRemainingOrg.slug}/`);
}

export function remove(api, {successMessage, errorMessage, orgId} = {}) {
  let endpoint = `/organizations/${orgId}/`;
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

export function fetchOrganizationDetails(orgId, {setActive, loadProjects, loadTeam}) {
  let api = new Client();
  let request = api.requestPromise(`/organizations/${orgId}/`);

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
