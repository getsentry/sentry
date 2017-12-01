import {browserHistory} from 'react-router';

import IndicatorStore from '../stores/indicatorStore';
import OrganizationStore from '../stores/organizationStore';
import OrganizationsActions from '../actions/organizationsActions';

export function redirectToRemainingOrganization({orgId}) {
  // Remove queued, should redirect
  let allOrgs = OrganizationStore.getAll().filter(org => org.slug !== orgId);
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
