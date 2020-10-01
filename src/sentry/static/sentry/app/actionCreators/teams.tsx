import {Client} from 'app/api';
import TeamActions from 'app/actions/teamActions';
import {tct} from 'app/locale';
import {addSuccessMessage, addErrorMessage} from 'app/actionCreators/indicator';
import {uniqueId} from 'app/utils/guid';
import {Team} from 'app/types';
import {callIfFunction} from 'app/utils/callIfFunction';

type CallbackOptions = {
  success?: Function;
  error?: Function;
};

const doCallback = (
  params: CallbackOptions = {},
  name: keyof CallbackOptions,
  ...args: any[]
) => {
  callIfFunction(params[name], ...args);
};

/**
 * Note these are both slugs
 */
type OrgSlug = {orgId: string};
type OrgAndTeamSlug = OrgSlug & {teamId: string};

type TeamData = {data: Team};

/**
 * This is the actual internal id, not username or email
 */
type MemberId = {memberId: string};

// Fetch teams for org
export function fetchTeams(api: Client, params: OrgSlug, options: CallbackOptions) {
  TeamActions.fetchAll(params.orgId);
  return api.request(`/teams/${params.orgId}/`, {
    success: data => {
      TeamActions.fetchAllSuccess(params.orgId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      TeamActions.fetchAllError(params.orgId, error);
      doCallback(options, 'error', error);
    },
  });
}

export function fetchTeamDetails(
  api: Client,
  params: OrgAndTeamSlug,
  options: CallbackOptions
) {
  TeamActions.fetchDetails(params.teamId);
  return api.request(`/teams/${params.orgId}/${params.teamId}/`, {
    success: data => {
      TeamActions.fetchDetailsSuccess(params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      TeamActions.fetchDetailsError(params.teamId, error);
      doCallback(options, 'error', error);
    },
  });
}

export function updateTeamSuccess(teamId: OrgAndTeamSlug['teamId'], data: Team) {
  TeamActions.updateSuccess(teamId, data);
}

export function updateTeam(
  api: Client,
  params: OrgAndTeamSlug & TeamData,
  options: CallbackOptions
) {
  const endpoint = `/teams/${params.orgId}/${params.teamId}/`;
  TeamActions.update(params.teamId, params.data);

  return api.request(endpoint, {
    method: 'PUT',
    data: params.data,
    success: data => {
      updateTeamSuccess(params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      TeamActions.updateError(params.teamId, error);
      doCallback(options, 'error', error);
    },
  });
}

export function joinTeam(
  api: Client,
  params: OrgAndTeamSlug & Partial<MemberId>,
  options: CallbackOptions
) {
  const endpoint = `/organizations/${params.orgId}/members/${
    params.memberId ?? 'me'
  }/teams/${params.teamId}/`;
  const id = uniqueId();

  TeamActions.update(id, params.teamId);

  return api.request(endpoint, {
    method: 'POST',
    success: data => {
      TeamActions.updateSuccess(params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      TeamActions.updateError(id, params.teamId, error);
      doCallback(options, 'error', error);
    },
  });
}

export function leaveTeam(
  api: Client,
  params: OrgAndTeamSlug & MemberId,
  options: CallbackOptions
) {
  const endpoint = `/organizations/${params.orgId}/members/${
    params.memberId || 'me'
  }/teams/${params.teamId}/`;
  const id = uniqueId();

  TeamActions.update(id, params.teamId);

  return api.request(endpoint, {
    method: 'DELETE',
    success: data => {
      TeamActions.updateSuccess(params.teamId, data);
      doCallback(options, 'success', data);
    },
    error: error => {
      TeamActions.updateError(id, params.teamId, error);
      doCallback(options, 'error', error);
    },
  });
}

export function createTeam(api: Client, team: Pick<Team, 'slug'>, params: OrgSlug) {
  TeamActions.createTeam(team);

  return api
    .requestPromise(`/organizations/${params.orgId}/teams/`, {
      method: 'POST',
      data: team,
    })
    .then(
      data => {
        TeamActions.createTeamSuccess(data);
        addSuccessMessage(
          tct('[team] has been added to the [organization] organization', {
            team: `#${data.slug}`,
            organization: params.orgId,
          })
        );
        return data;
      },
      err => {
        TeamActions.createTeamError(team.slug, err);
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
  TeamActions.removeTeam(params.teamId);

  return api
    .requestPromise(`/teams/${params.orgId}/${params.teamId}/`, {
      method: 'DELETE',
    })
    .then(
      data => {
        TeamActions.removeTeamSuccess(params.teamId, data);
        addSuccessMessage(
          tct('[team] has been removed from the [organization] organization', {
            team: `#${params.teamId}`,
            organization: params.orgId,
          })
        );
        return data;
      },
      err => {
        TeamActions.removeTeamError(params.teamId, err);
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
