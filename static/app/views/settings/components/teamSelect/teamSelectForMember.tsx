import React from 'react';
import styled from '@emotion/styled';
import startCase from 'lodash/startCase';

import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import {TeamBadge} from 'sentry/components/idBadge/teamBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
import TeamRoleSelect from 'sentry/components/teamRoleSelect';
import {IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Member, Organization, Team} from 'sentry/types';
import {getEffectiveOrgRole} from 'sentry/utils/orgRole';
import useTeams from 'sentry/utils/useTeams';
import {RoleOverwritePanelAlert} from 'sentry/views/settings/organizationTeams/roleOverwriteWarning';
import {getButtonHelpText} from 'sentry/views/settings/organizationTeams/utils';

import {DropdownAddTeam, TeamSelectProps} from './utils';

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

  // Determine if adding a team changes the minimum team-role
  // Get org-roles from team membership, if any
  const groupOrgRoles = selectedTeams
    .filter(team => team.orgRole)
    .map(team => team.orgRole as string);
  if (selectedOrgRole) {
    groupOrgRoles.push(selectedOrgRole);
  }

  // Sort them and to get the highest priority role
  // Highest priority role may change minimum team role
  const effectiveOrgRole = getEffectiveOrgRole(groupOrgRoles, orgRoleList);

  const renderBody = () => {
    if (selectedTeams.length === 0) {
      return <EmptyMessage>{t('No Teams assigned')}</EmptyMessage>;
    }

    return (
      <React.Fragment>
        {organization.features.includes('team-roles') && effectiveOrgRole && (
          <RoleOverwritePanelAlert
            orgRole={effectiveOrgRole?.id}
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
              orgRolesFromTeams: [{role: effectiveOrgRole, teamSlug: ''}],
              orgRole: selectedOrgRole,
              teamRoles: selectedTeamRoles,
            }}
            onChangeTeamRole={onChangeTeamRole}
            onRemoveTeam={slug => onRemoveTeam(slug)}
          />
        ))}
      </React.Fragment>
    );
  };

  return (
    <Panel>
      <PanelHeader hasButtons>
        {t('Team')}
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
      </PanelHeader>

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
  const hasOrgAdmin = organization.access.includes('org:admin');
  const isIdpProvisioned = team.flags['idp:provisioned'];
  const isPermissionGroup = team.orgRole !== null && !hasOrgAdmin;
  const isRemoveDisabled = disabled || isIdpProvisioned || isPermissionGroup;

  const buttonHelpText = getButtonHelpText(isIdpProvisioned, isPermissionGroup);
  const orgRoleFromTeam = team.orgRole ? `${startCase(team.orgRole)} Team` : null;

  return (
    <TeamPanelItem data-test-id="team-row-for-member">
      <TeamPanelItemLeft>
        <Link to={`/settings/${organization.slug}/teams/${team.slug}/`}>
          <TeamBadge team={team} />
        </Link>
      </TeamPanelItemLeft>

      <TeamOrgRole>{orgRoleFromTeam}</TeamOrgRole>

      {organization.features.includes('team-roles') && (
        <RoleSelectWrapper>
          <TeamRoleSelect
            disabled={disabled}
            size="xs"
            organization={organization}
            team={team}
            member={member}
            onChangeTeamRole={newRole => onChangeTeamRole(team.slug, newRole)}
          />
        </RoleSelectWrapper>
      )}

      <Button
        size="xs"
        icon={<IconSubtract isCircled size="xs" />}
        title={buttonHelpText}
        disabled={isRemoveDisabled}
        onClick={() => onRemoveTeam(team.slug)}
      >
        {t('Remove')}
      </Button>
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

const TeamOrgRole = styled('div')`
  min-width: 90px;
  flex-grow: 1;
  display: flex;
  justify-content: center;
`;

const RoleSelectWrapper = styled('div')`
  min-width: 200px;
  margin-right: ${space(2)};
`;

export default TeamSelect;
