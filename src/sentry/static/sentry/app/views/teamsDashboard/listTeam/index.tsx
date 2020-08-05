import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Organization, Team} from 'app/types';
import space from 'app/styles/space';

import TeamCard from './teamCard';

type Props = {
  organization: Organization;
  hasTeamAdminAccess: boolean;
  hasOpenMembership: boolean;
  location: Location;
  teams: Array<Team>;
  onJoinTeam: (team: Team) => () => void;
  onLeaveTeam: (team: Team) => () => void;
};

const ListTeam = ({teams, onLeaveTeam, onJoinTeam, ...props}: Props) => (
  <TeamCards>
    {teams.map(team => (
      <TeamCard
        key={team.id}
        {...props}
        team={team}
        onLeaveTeam={onLeaveTeam(team)}
        onJoinTeam={onJoinTeam(team)}
      />
    ))}
  </TeamCards>
);

export default ListTeam;

const TeamCards = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  grid-gap: ${space(3)};
`;
