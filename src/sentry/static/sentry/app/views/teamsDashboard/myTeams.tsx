import React from 'react';

import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Button from 'app/components/button';
import {t} from 'app/locale';
import {IconFile, IconMegaphone} from 'app/icons';

import TeamsNotFound from './teamsNotFound';
import ListTeam from './listTeam';

type ListTeamProps = React.ComponentProps<typeof ListTeam>;
type TeamsNotFoundProps = React.ComponentProps<typeof TeamsNotFound>;

type Props = ListTeamProps &
  TeamsNotFoundProps & {
    myTeams: ListTeamProps['teams'];
  };

const MyTeams = (props: Props) => {
  const {teams, onCreateTeam, organization, hasTeamAdminAccess, myTeams} = props;

  if (teams.length === 0) {
    return (
      <TeamsNotFound
        onCreateTeam={onCreateTeam}
        hasTeamAdminAccess={hasTeamAdminAccess}
      />
    );
  }

  if (myTeams.length === 0) {
    return (
      <EmptyMessage
        size="large"
        title={t("You haven't joined any team yet.")}
        icon={<IconFile size="xl" />}
        action={
          <Button
            size="small"
            to={`/organizations/${organization.slug}/teams`}
            icon={<IconMegaphone size="xs" />}
          >
            {t('Join Team')}
          </Button>
        }
      />
    );
  }

  return <ListTeam {...props} teams={myTeams} hasTeamAdminAccess={hasTeamAdminAccess} />;
};

export default MyTeams;
