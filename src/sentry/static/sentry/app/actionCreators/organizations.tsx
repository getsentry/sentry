import {browserHistory} from 'react-router';

import {Client} from 'app/api';
import {Organization, LightWeightOrganization} from 'app/types';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {resetGlobalSelection} from 'app/actionCreators/globalSelection';
import OrganizationActions from 'app/actions/organizationActions';
import OrganizationsActions from 'app/actions/organizationsActions';
import OrganizationsStore from 'app/stores/organizationsStore';
import ProjectsStore from 'app/stores/projectsStore';
import TeamStore from 'app/stores/teamStore';

type RedirectRemainingOrganizationParams = {
  /**
   * The organization slug
   */
  orgId: string;

  /**
   * Should remove org?
   */
  removeOrg?: boolean;
};

/**
 * After removing an organization, this will redirect to a remaining active organization or
 * the screen to create a new organization.
 *
 * Can optionally remove organization from organizations store.
 */
export function redirectToRemainingOrganization({
  orgId,
  removeOrg,
}: RedirectRemainingOrganizationParams) {
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

type RemoveParams = {
  /**
   * The organization slug
   */
  orgId: string;

  /**
   * An optional error message to be used in a toast, if remove fails
   */
  errorMessage?: string;

  /**
   * An optional success message to be used in a toast, if remove succeeds
   */
  successMessage?: string;
};

export function remove(api: Client, {successMessage, errorMessage, orgId}: RemoveParams) {
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

export function removeAndRedirectToRemainingOrganization(
  api: Client,
  params: RedirectRemainingOrganizationParams & RemoveParams
) {
  remove(api, params).then(() => redirectToRemainingOrganization(params));
}

/**
 * Set active organization
 */
export function setActiveOrganization(org: LightWeightOrganization) {
  OrganizationsActions.setActive(org);
}

export function changeOrganizationSlug(
  prev: Organization,
  next: Partial<Organization> & Pick<Organization, 'slug'>
) {
  OrganizationsActions.changeSlug(prev, next);
}

/**
 * Updates an organization for the store
 *
 * Accepts a partial organization as it will merge will existing organization
 */
export function updateOrganization(org: Partial<LightWeightOrganization>) {
  OrganizationsActions.update(org);
  OrganizationActions.update(org);
}

type FetchOrganizationByMemberParams = {
  addOrg?: boolean;
  fetchOrgDetails?: boolean;
};

export async function fetchOrganizationByMember(
  memberId: string,
  {addOrg, fetchOrgDetails}: FetchOrganizationByMemberParams
) {
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

type FetchOrganizationDetailsParams = {
  /**
   * Should set as active organization?
   */
  setActive?: boolean;

  /**
   * Should load teams in TeamStore?
   */
  loadTeam?: boolean;

  /**
   * Should load projects in ProjectsStore
   */
  loadProjects?: boolean;
};
export async function fetchOrganizationDetails(
  orgId: string,
  {setActive, loadProjects, loadTeam}: FetchOrganizationDetailsParams
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
