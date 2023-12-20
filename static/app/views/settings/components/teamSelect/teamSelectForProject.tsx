import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import EmptyMessage from 'sentry/components/emptyMessage';
import {TeamBadge} from 'sentry/components/idBadge/teamBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project, Team} from 'sentry/types';
import {useTeams} from 'sentry/utils/useTeams';

import {DropdownAddTeam, TeamSelectProps} from './utils';

type Props = TeamSelectProps & {
  canCreateTeam: boolean;
  project: Project;
  /**
   * Used when showing Teams for a Project
   */
  selectedTeams: Team[];
};

function TeamSelect({
  disabled,
  canCreateTeam,
  project,
  selectedTeams,
  organization,
  onAddTeam,
  onRemoveTeam,
  onCreateTeam,
}: Props) {
  const renderBody = () => {
    const numTeams = selectedTeams.length;
    if (numTeams === 0) {
      return <EmptyMessage>{t('No Teams assigned')}</EmptyMessage>;
    }

    // If the user is not a team-admin in any parent teams of this project, they will
    // not be able to edit the configuration. Warn the user if this is their last team
    // where they have team-admin role.
    const isUserLastTeamWrite =
      selectedTeams.reduce(
        (count, team) => (team.access.includes('team:write') ? count + 1 : count),
        0
      ) === 1;
    const isOnlyTeam = numTeams === 1;

    const confirmMessage = isUserLastTeamWrite
      ? t(
          "This is the last team that grants Team Admin access to you for this project. After removing this team, you will not be able to edit this project's configuration."
        )
      : isOnlyTeam
      ? t(
          'This is the last team with access to this project. After removing this team, only organization owners and managers will be able to access the project pages.'
        )
      : t(
          'Removing this team from the project means that members of the team can no longer access this project. Do you want to continue?'
        );

    return (
      <Fragment>
        {selectedTeams.map(team => (
          <TeamRow
            key={team.slug}
            disabled={disabled || !team.access.includes('team:write')}
            confirmMessage={confirmMessage}
            organization={organization}
            team={team}
            onRemoveTeam={slug => onRemoveTeam(slug)}
          />
        ))}
      </Fragment>
    );
  };

  const {teams, onSearch, fetching: isLoadingTeams} = useTeams();

  return (
    <Panel>
      <PanelHeader hasButtons>
        {t('Team')}

        <DropdownAddTeam
          disabled={disabled}
          isLoadingTeams={isLoadingTeams}
          isAddingTeamToProject
          canCreateTeam={canCreateTeam}
          onSearch={onSearch}
          onSelect={onAddTeam}
          onCreateTeam={onCreateTeam}
          organization={organization}
          selectedTeams={selectedTeams.map(tm => tm.slug)}
          teams={teams}
          project={project}
        />
      </PanelHeader>

      <PanelBody>{isLoadingTeams ? <LoadingIndicator /> : renderBody()}</PanelBody>
    </Panel>
  );
}

function TeamRow({
  organization,
  team,
  onRemoveTeam,
  disabled,
  confirmMessage,
}: {
  confirmMessage: string | null;
  disabled: boolean;
  onRemoveTeam: Props['onRemoveTeam'];
  organization: Organization;
  team: Team;
}) {
  return (
    <TeamPanelItem data-test-id="team-row-for-project">
      <TeamPanelItemLeft>
        <Link to={`/settings/${organization.slug}/teams/${team.slug}/`}>
          <TeamBadge team={team} />
        </Link>
      </TeamPanelItemLeft>

      <Confirm
        message={confirmMessage}
        bypass={!confirmMessage}
        onConfirm={() => onRemoveTeam(team.slug)}
        disabled={disabled}
        confirmText="Remove Team"
      >
        <Button size="xs" icon={<IconSubtract isCircled />} disabled={disabled}>
          {t('Remove')}
        </Button>
      </Confirm>
    </TeamPanelItem>
  );
}

const TeamPanelItem = styled(PanelItem)`
  padding: ${space(2)};
  align-items: center;
  justify-content: space-between;
`;

const TeamPanelItemLeft = styled('div')`
  flex-grow: 4;
`;

export default TeamSelect;
