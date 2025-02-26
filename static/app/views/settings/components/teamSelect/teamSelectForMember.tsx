import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import {TeamBadge} from 'sentry/components/idBadge/teamBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import TeamRoleSelect from 'sentry/components/teamRoleSelect';
import {TeamRoleColumnLabel} from 'sentry/components/teamRoleUtils';
import {IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Member, Organization, Team} from 'sentry/types/organization';
import {useTeams} from 'sentry/utils/useTeams';
import {RoleOverwritePanelAlert} from 'sentry/views/settings/organizationTeams/roleOverwriteWarning';
import {getButtonHelpText} from 'sentry/views/settings/organizationTeams/utils';

import type {TeamSelectProps} from './utils';
import {DropdownAddTeam} from './utils';

type Props = TeamSelectProps & {
  /**
   * Member that this component is acting upon
   */
  member: Member;
  /**
   * Used when showing Teams for a Member
   */
  onChangeTeamRole: (teamSlug: string, teamRole: string) => void;
  /**
   * Used when showing Teams for a Member
   */
  selectedOrgRole: Member['orgRole'];
  /**
   * Used when showing Teams for a Member
   */
  selectedTeamRoles: Member['teamRoles'];
};

function TeamSelect({
  disabled,
  loadingTeams,
  member,
  selectedOrgRole,
  selectedTeamRoles,
  organization,
  onAddTeam,
  onRemoveTeam,
  onCreateTeam,
  onChangeTeamRole,
}: Props) {
  const {teams, onSearch, fetching: isLoadingTeams} = useTeams();
  const {orgRoleList, teamRoleList} = organization;

  const selectedTeamSlugs = new Set(selectedTeamRoles.map(tm => tm.teamSlug));
  const selectedTeams = teams.filter(tm => selectedTeamSlugs.has(tm.slug));

  const renderBody = () => {
    if (selectedTeams.length === 0) {
      return <EmptyMessage>{t('No Teams assigned')}</EmptyMessage>;
    }

    return (
      <Fragment>
        {selectedOrgRole && (
          <RoleOverwritePanelAlert
            orgRole={selectedOrgRole}
            orgRoleList={orgRoleList}
            teamRoleList={teamRoleList}
          />
        )}

        {selectedTeams.map(team => (
          <TeamRow
            key={team.slug}
            disabled={disabled}
            organization={organization}
            team={team}
            member={{
              ...member,
              orgRole: selectedOrgRole,
              teamRoles: selectedTeamRoles,
            }}
            onChangeTeamRole={onChangeTeamRole}
            onRemoveTeam={slug => onRemoveTeam(slug)}
          />
        ))}
      </Fragment>
    );
  };

  return (
    <Panel>
      <TeamPanelHeader hasButtons>
        <div>{t('Team')}</div>
        <div>
          <TeamRoleColumnLabel />
        </div>
        <div>
          <DropdownAddTeam
            disabled={disabled}
            isLoadingTeams={isLoadingTeams}
            isAddingTeamToMember
            canCreateTeam={false}
            onSearch={onSearch}
            onSelect={onAddTeam}
            onCreateTeam={onCreateTeam}
            organization={organization}
            selectedTeams={selectedTeams.map(tm => tm.slug)}
            teams={teams}
          />
        </div>
      </TeamPanelHeader>

      <PanelBody>{loadingTeams ? <LoadingIndicator /> : renderBody()}</PanelBody>
    </Panel>
  );
}

function TeamRow({
  disabled,
  organization,
  team,
  member,
  onRemoveTeam,
  onChangeTeamRole,
}: {
  disabled: boolean;
  member: Member;
  onChangeTeamRole: Props['onChangeTeamRole'];
  onRemoveTeam: Props['onRemoveTeam'];
  organization: Organization;
  team: Team;
}) {
  const isIdpProvisioned = team.flags['idp:provisioned'];
  const isRemoveDisabled = disabled || isIdpProvisioned;

  const buttonHelpText = getButtonHelpText(isIdpProvisioned);

  return (
    <TeamPanelItem data-test-id="team-row-for-member">
      <div>
        <Link to={`/settings/${organization.slug}/teams/${team.slug}/`}>
          <TeamBadge team={team} />
        </Link>
      </div>

      <div style={{whiteSpace: 'nowrap'}}>
        <TeamRoleSelect
          disabled={disabled}
          size="xs"
          organization={organization}
          team={team}
          member={member}
          onChangeTeamRole={newRole => onChangeTeamRole(team.slug, newRole)}
        />
      </div>

      <div>
        <Button
          size="xs"
          icon={<IconSubtract isCircled />}
          title={buttonHelpText}
          disabled={isRemoveDisabled}
          onClick={() => onRemoveTeam(team.slug)}
        >
          {t('Remove')}
        </Button>
      </div>
    </TeamPanelItem>
  );
}

const GRID_TEMPLATE = `
  display: grid;
  grid-template-columns: minmax(100px, 1fr) minmax(0px, 100px) 200px;
  gap: ${space(1)};

  > div:last-child {
    margin-left: auto;
  }
`;

const TeamPanelHeader = styled(PanelHeader)`
  ${GRID_TEMPLATE}
`;

const TeamPanelItem = styled(PanelItem)`
  ${GRID_TEMPLATE}
  padding: ${space(2)};
`;

export default TeamSelect;
