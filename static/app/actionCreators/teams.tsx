import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {tct} from 'sentry/locale';
import TeamStore from 'sentry/stores/teamStore';
import type {Team} from 'sentry/types/organization';

type CallbackOptions = {
  error?: (...args: unknown[]) => void;
  success?: (...args: unknown[]) => void;
};

const doCallback = (
  params: CallbackOptions = {},
  name: keyof CallbackOptions,
  ...args: any[]
) => params[name]?.(...args);
/**
 * Note these are both slugs
 */
type OrgSlug = {orgId: string};
type OrgAndTeamSlug = OrgSlug & {teamId: string};

/**
 * This is the actual internal id, not username or email
 */
type MemberId = {memberId: string};

// Fetch user teams for current org and place them in the team store
export async function fetchUserTeams(api: Client, params: OrgSlug) {
  const teams = await api.requestPromise(`/organizations/${params.orgId}/user-teams/`);
  TeamStore.loadUserTeams(teams);
}

export function fetchTeamDetails(
  api: Client,
  params: OrgAndTeamSlug,
  options?: CallbackOptions
) {
  return api.request(`/teams/${params.orgId}/${params.teamId}/`, {
    success: data => {
      TeamStore.onUpdateSuccess(params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      doCallback(options, 'error', error);
    },
  });
}

export function updateTeamSuccess(teamId: OrgAndTeamSlug['teamId'], data: Team) {
  TeamStore.onUpdateSuccess(teamId, data);
}

/**
 * @deprecated use joinTeamPromise instead
 */
export function joinTeam(
  api: Client,
  params: OrgAndTeamSlug & Partial<MemberId>,
  options: CallbackOptions
) {
  const endpoint = `/organizations/${params.orgId}/members/${
    params.memberId ?? 'me'
  }/teams/${params.teamId}/`;

  return api.request(endpoint, {
    method: 'POST',
    success: data => {
      TeamStore.onUpdateSuccess(params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      doCallback(options, 'error', error);
    },
  });
}

export async function joinTeamPromise(
  api: Client,
  params: OrgAndTeamSlug & Partial<MemberId>
) {
  const data: Team = await api.requestPromise(
    `/organizations/${params.orgId}/members/${params.memberId ?? 'me'}/teams/${params.teamId}/`,
    {
      method: 'POST',
    }
  );

  TeamStore.onUpdateSuccess(params.teamId, data);

  return data;
}

/**
 * @deprecated use leaveTeamPromise instead
 */
export function leaveTeam(
  api: Client,
  params: OrgAndTeamSlug & Partial<MemberId>,
  options: CallbackOptions
) {
  const endpoint = `/organizations/${params.orgId}/members/${
    params.memberId || 'me'
  }/teams/${params.teamId}/`;

  return api.request(endpoint, {
    method: 'DELETE',
    success: data => {
      TeamStore.onUpdateSuccess(params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      doCallback(options, 'error', error);
    },
  });
}

export async function leaveTeamPromise(
  api: Client,
  params: OrgAndTeamSlug & Partial<MemberId>
) {
  const data: Team = await api.requestPromise(
    `/organizations/${params.orgId}/members/${params.memberId ?? 'me'}/teams/${params.teamId}/`,
    {
      method: 'DELETE',
    }
  );

  TeamStore.onUpdateSuccess(params.teamId, data);

  return data;
}

export function createTeam(api: Client, team: Pick<Team, 'slug'>, params: OrgSlug) {
  return api
    .requestPromise(`/organizations/${params.orgId}/teams/`, {
      method: 'POST',
      data: team,
    })
    .then(
      data => {
        TeamStore.onCreateSuccess(data);
        addSuccessMessage(
          tct('[team] has been added to the [organization] organization', {
            team: `#${data.slug}`,
            organization: params.orgId,
          })
        );
        return data;
      },
      err => {
        addErrorMessage(
          tct('Unable to create [team] in the [organization] organization', {
            team: `#${team.slug}`,
            organization: params.orgId,
          })
        );
        throw err;
      }
    );
}

export function removeTeam(api: Client, params: OrgAndTeamSlug) {
  return api
    .requestPromise(`/teams/${params.orgId}/${params.teamId}/`, {
      method: 'DELETE',
    })
    .then(
      data => {
        TeamStore.onRemoveSuccess(params.teamId);
        addSuccessMessage(
          tct('[team] has been removed from the [organization] organization', {
            team: `#${params.teamId}`,
            organization: params.orgId,
          })
        );
        return data;
      },
      err => {
        addErrorMessage(
          tct('Unable to remove [team] from the [organization] organization', {
            team: `#${params.teamId}`,
            organization: params.orgId,
          })
        );
        throw err;
      }
    );
}
