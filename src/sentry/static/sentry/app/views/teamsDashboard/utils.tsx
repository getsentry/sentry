import {tct} from 'app/locale';
import {Client} from 'app/api';
import {joinTeam, leaveTeam} from 'app/actionCreators/teams';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Organization, Team} from 'app/types';

export enum TAB {
  ALL_TEAMS = 'all_teams',
  MY_TEAMS = 'my_teams',
}

type LeaveTheTeamProps = {
  teamToLeave: Team;
  organization: Organization;
  api: Client;
  onSubmitSuccess?: (team: Team) => void;
};

export function leaveTheTeam({
  teamToLeave,
  organization,
  api,
  onSubmitSuccess,
}: LeaveTheTeamProps) {
  leaveTeam(
    api,
    {
      orgId: organization.slug,
      teamId: teamToLeave.slug,
    },
    {
      success: (leftTeam: Team) => {
        if (onSubmitSuccess) {
          onSubmitSuccess(leftTeam);
        }
        addSuccessMessage(
          tct('You have left [team]', {
            team: `#${teamToLeave.slug}`,
          })
        );
      },
      error: () => {
        addErrorMessage(
          tct('Unable to leave [team]', {
            team: `#${teamToLeave.slug}`,
          })
        );
      },
    }
  );
}

type JoinTheTeamProps = Omit<LeaveTheTeamProps, 'teamToLeave'> & {
  teamToJoin: Team;
  type?: 'join' | 'request';
};

export function joinTheTeam({
  teamToJoin,
  organization,
  api,
  onSubmitSuccess,
  type = 'join',
}: JoinTheTeamProps) {
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
        addSuccessMessage(
          type === 'join'
            ? tct('You have joined [team]', {team: `#${teamToJoin.slug}`})
            : tct('You have requested access to [team]', {team: `#${teamToJoin.slug}`})
        );
      },
      error: () => {
        addErrorMessage(
          type === 'join'
            ? tct('Unable to join [team]', {team: `#${teamToJoin.slug}`})
            : tct('Unable to request access to [team]', {team: `#${teamToJoin.slug}`})
        );
      },
    }
  );
}
