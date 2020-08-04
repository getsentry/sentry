import React from 'react';

import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Button from 'app/components/button';
import {t} from 'app/locale';
import {IconAdd, IconFile} from 'app/icons';

import TeamCard from './teamCard';

type Props = {
  handleCreateTeam: any;
};

class ListTeam extends React.Component<Props> {
  render() {
    const {organization, location, teams} = this.props;

    const access = new Set(organization.access);
    const hasTeamAdminAccess = access.has('project:admin');

    const displayMyTeams = location.pathname.endsWith('my-teams/');
    const displayTeams = displayMyTeams ? teams.filter(team => team.isMember) : teams;

    return displayTeams.length > 0 ? (
      displayTeams.map(displayTeam => (
        <TeamCard
          key={displayTeam.id}
          hasTeamAdminAccess={hasTeamAdminAccess}
          organization={organization}
          team={displayTeam}
        />
      ))
    ) : (
      <EmptyMessage
        size="large"
        title={t('No teams have been created yet.')}
        icon={<IconFile size="xl" />}
        action={
          <Button
            size="small"
            disabled={!hasTeamAdminAccess}
            title={
              !hasTeamAdminAccess
                ? t('You do not have permission to create teams')
                : undefined
            }
            onClick={this.props.handleCreateTeam}
            icon={<IconAdd size="xs" isCircled />}
          >
            {t('Create Team')}
          </Button>
        }
      />
    );
  }
}

export default ListTeam;
