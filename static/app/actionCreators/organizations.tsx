import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {resetPageFilters} from 'sentry/actionCreators/pageFilters';
import type {Client} from 'sentry/api';
import {USING_CUSTOMER_DOMAIN} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';
import GuideStore from 'sentry/stores/guideStore';
import LatestContextStore from 'sentry/stores/latestContextStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import type {Organization} from 'sentry/types/organization';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import type {useNavigate} from 'sentry/utils/useNavigate';

type RedirectRemainingOrganizationParams = {
  navigate: ReturnType<typeof useNavigate>;

  /**
   * The organization slug
   */
  orgSlug: string;
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
  orgSlug,
  removeOrg,
  navigate,
}: RedirectRemainingOrganizationParams) {
  // Remove queued, should redirect
  const allOrgs = OrganizationsStore.getAll().filter(
    org => org.status.id === 'active' && org.slug !== orgSlug
  );
  if (!allOrgs.length) {
    navigate('/organizations/new/');
    return;
  }

  // Let's be smart and select the best org to redirect to
  const firstRemainingOrg = allOrgs[0];

  const route = `/organizations/${firstRemainingOrg.slug}/issues/`;
  if (USING_CUSTOMER_DOMAIN) {
    const {organizationUrl} = firstRemainingOrg.links;
    window.location.assign(`${organizationUrl}${normalizeUrl(route)}`);
    return;
  }

  navigate(route);

  // Remove org from SidebarDropdown
  if (removeOrg) {
    OrganizationsStore.remove(orgSlug);
  }
}

type RemoveParams = {
  /**
   * The organization slug
   */
  orgSlug: string;

  /**
   * An optional error message to be used in a toast, if remove fails
   */
  errorMessage?: string;

  /**
   * An optional success message to be used in a toast, if remove succeeds
   */
  successMessage?: string;
};

export function remove(
  api: Client,
  {successMessage, errorMessage, orgSlug}: RemoveParams
) {
  const endpoint = `/organizations/${orgSlug}/`;
  return api
    .requestPromise(endpoint, {
      method: 'DELETE',
    })
    .then(() => {
      OrganizationsStore.onRemoveSuccess(orgSlug);

      if (successMessage) {
        addSuccessMessage(successMessage);
      }
    })
    .catch(() => {
      if (errorMessage) {
        addErrorMessage(errorMessage);
      }
    });
}

export function switchOrganization() {
  resetPageFilters();
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
export function setActiveOrganization(org: Organization) {
  GuideStore.setActiveOrganization(org);
  LatestContextStore.onSetActiveOrganization(org);
}

export function changeOrganizationSlug(
  prev: Organization,
  next: Partial<Organization> & Pick<Organization, 'slug'>
) {
  OrganizationsStore.onChangeSlug(prev, next);
}

/**
 * Updates an organization for the store
 *
 * Accepts a partial organization as it will merge will existing organization
 */
export function updateOrganization(org: Partial<Organization>) {
  OrganizationsStore.onUpdate(org);
  OrganizationStore.onUpdate(org);
}

type FetchOrganizationByMemberParams = {
  addOrg?: boolean;
  fetchOrgDetails?: boolean;
};

export async function fetchOrganizationByMember(
  api: Client,
  memberId: string,
  {addOrg, fetchOrgDetails}: FetchOrganizationByMemberParams
) {
  const data = await api.requestPromise(`/organizations/?query=member_id:${memberId}`);

  if (!data.length) {
    return null;
  }

  const org = data[0];

  if (addOrg) {
    // add org to SwitchOrganization dropdown
    OrganizationsStore.addOrReplace(org);
  }

  if (fetchOrgDetails) {
    // load SidebarDropdown with org details including `access`
    await fetchOrganizationDetails(api, org.slug, {setActive: true, loadProjects: true});
  }

  return org;
}

type FetchOrganizationDetailsParams = {
  /**
   * Should load projects in ProjectsStore
   */
  loadProjects?: boolean;

  /**
   * Should load teams in TeamStore?
   */
  loadTeam?: boolean;

  /**
   * Should set as active organization?
   */
  setActive?: boolean;
};
export async function fetchOrganizationDetails(
  api: Client,
  orgId: string,
  {setActive, loadProjects, loadTeam}: FetchOrganizationDetailsParams
) {
  const data = await api.requestPromise(`/organizations/${orgId}/`, {
    query: {
      include_feature_flags: 1,
    },
  });

  if (setActive) {
    setActiveOrganization(data);
  }

  if (loadTeam) {
    TeamStore.loadInitialData(data.teams, false, null);
  }

  if (loadProjects) {
    ProjectsStore.loadInitialData(data.projects || []);
  }

  return data;
}

/**
 * Get all organizations for the current user.
 *
 * Will perform a fan-out across all multi-tenant regions,
 * and single-tenant regions the user has membership in.
 *
 * This function is challenging to type as the structure of the response
 * from /organizations can vary based on query parameters
 */
export async function fetchOrganizations(api: Client, query?: Record<string, any>) {
  const regions = ConfigStore.get('memberRegions');
  const results = await Promise.all(
    regions.map(region =>
      api.requestPromise(`/organizations/`, {
        host: region.url,
        query,
        // Authentication errors can happen as we span regions.
        allowAuthError: true,
      })
    )
  );
  return results.reduce((acc, response) => {
    // Don't append error results to the org list.
    if (response[0]) {
      acc = acc.concat(response);
    }
    return acc;
  }, []);
}
