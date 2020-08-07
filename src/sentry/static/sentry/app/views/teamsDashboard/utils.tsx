import {tct} from 'app/locale';
import {Client} from 'app/api';
import {joinTeam, leaveTeam} from 'app/actionCreators/teams';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Organization, Team, Member} from 'app/types';

export enum TAB {
  ALL_TEAMS = 'all_teams',
  MY_TEAMS = 'my_teams',
}

type LeaveTheTeamProps = {
  teamToLeave: Team;
  organization: Organization;
  api: Client;
  memberId?: Member['id'];
  onSubmitSuccess?: (team: Team) => void;
};

function getLeaveTheTeamOutcomeMessage(
  team: Team,
  memberId?: LeaveTheTeamProps['memberId']
) {
  if (memberId) {
    return {
      successMsg: tct('Successfully removed member from team [team]', {
        team: `#${team.slug}`,
      }),
      errorMsg: tct(
        'There was an error while trying to remove a member from the team [team].',
        {team: `#${team.slug}`}
      ),
    };
  }

  return {
    successMsg: tct('You have left [team].', {
      team: `#${team.slug}`,
    }),
    errorMsg: tct('Unable to leave [team].', {
      team: `#${team.slug}`,
    }),
  };
}

export function leaveTheTeam({
  teamToLeave,
  organization,
  api,
  onSubmitSuccess,
  memberId,
}: LeaveTheTeamProps) {
  const {errorMsg, successMsg} = getLeaveTheTeamOutcomeMessage(teamToLeave, memberId);

  leaveTeam(
    api,
    {
      orgId: organization.slug,
      teamId: teamToLeave.slug,
      memberId,
    },
    {
      success: (leftTeam: Team) => {
        if (onSubmitSuccess) {
          onSubmitSuccess(leftTeam);
        }
        addSuccessMessage(successMsg);
      },
      error: () => {
        addErrorMessage(errorMsg);
      },
    }
  );
}

type JoinTheTeamProps = Omit<LeaveTheTeamProps, 'teamToLeave' | 'type'> & {
  teamToJoin: Team;
  type?: 'join' | 'request' | 'member';
};

function getJoinTheTeamOutcomeMessage(type: JoinTheTeamProps['type'], team: Team) {
  if (type === 'join') {
    return {
      successMsg: tct('You have joined [team]', {team: `#${team.slug}`}),
      errorMsg: tct('You have requested access to [team]', {team: `#${team.slug}`}),
    };
  }

  if (type === 'request') {
    return {
      successMsg: tct('Unable to join [team]', {team: `#${team.slug}`}),
      errorMsg: tct('Unable to join [team]', {team: `#${team.slug}`}),
    };
  }

  return {
    successMsg: tct('Successfully added member in the team [team].', {
      team: `#${team.slug}`,
    }),
    errorMsg: tct('There was an error while trying to add a member in the team [team].', {
      team: `#${team.slug}`,
    }),
  };
}

export function joinTheTeam({
  teamToJoin,
  organization,
  api,
  onSubmitSuccess,
  type = 'join',
}: JoinTheTeamProps) {
  const {successMsg, errorMsg} = getJoinTheTeamOutcomeMessage(type, teamToJoin);

  joinTeam(
    api,
    {
      orgId: organization.slug,
      teamId: teamToJoin.slug,
    },
    {
      success: (joinedTeam: Team) => {
        if (onSubmitSuccess) {
          onSubmitSuccess(joinedTeam);
        }
        addSuccessMessage(successMsg);
      },
      error: () => {
        addErrorMessage(errorMsg);
      },
    }
  );
}
