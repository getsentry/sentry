import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Button from 'app/components/button';
import {t} from 'app/locale';
import {IconAdd, IconFile} from 'app/icons';
import {Organization, Team} from 'app/types';
import space from 'app/styles/space';

import TeamCard from './teamCard';

type Props = {
  organization: Organization;
  location: Location;
  teams: Array<Team>;
  handleCreateTeam: () => void;
};

class ListTeam extends React.Component<Props> {
  render() {
    const {organization, location, teams} = this.props;

    const access = new Set(organization.access);
    const hasTeamAdminAccess = access.has('project:admin');

    return teams.length > 0 ? (
      <TeamCards>
        {teams.map(displayTeam => (
          <TeamCard
            key={displayTeam.id}
            hasTeamAdminAccess={hasTeamAdminAccess}
            organization={organization}
            team={displayTeam}
            location={location}
          />
        ))}
      </TeamCards>
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

const TeamCards = styled('div')`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  grid-gap: ${space(3)};
`;
