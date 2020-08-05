import React from 'react';

import ListTeam from './listTeam';
import TeamsNotFound from './teamsNotFound';

type ListTeamProps = React.ComponentProps<typeof ListTeam>;
type TeamsNotFoundProps = React.ComponentProps<typeof TeamsNotFound>;

type Props = ListTeamProps & TeamsNotFoundProps;

const AllTeams = (props: Props) => {
  const {teams, onCreateTeam, hasTeamAdminAccess} = props;

  if (teams.length === 0) {
    return (
      <TeamsNotFound
        onCreateTeam={onCreateTeam}
        hasTeamAdminAccess={hasTeamAdminAccess}
      />
    );
  }

  return <ListTeam {...props} hasTeamAdminAccess={hasTeamAdminAccess} />;
};

export default AllTeams;
