import React from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import startCase from 'lodash/startCase';

import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import {Item} from 'sentry/components/dropdownAutoComplete/types';
import DropdownButton from 'sentry/components/dropdownButton';
import EmptyMessage from 'sentry/components/emptyMessage';
import {TeamBadge} from 'sentry/components/idBadge/teamBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
import TeamRoleSelect from 'sentry/components/teamRoleSelect';
import {Tooltip} from 'sentry/components/tooltip';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconSubtract} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Member, Organization, Team} from 'sentry/types';
import {getEffectiveOrgRole} from 'sentry/utils/orgRole';
import useTeams from 'sentry/utils/useTeams';
import {RoleOverwritePanelAlert} from 'sentry/views/settings/organizationTeams/roleOverwriteWarning';
import {getButtonHelpText} from 'sentry/views/settings/organizationTeams/utils';

type Props = {
  /**
   * Should button be disabled
   */
  disabled: boolean;
  /**
   * Used when showing Teams for a Member
   * Prevent changes to a SCIM-provisioned member
   */
  enforceIdpProvisioned: boolean;
  /**
   * callback when teams are added
   */
  onAddTeam: (teamSlug: string) => void;
  /**
   * Callback when teams are removed
   */
  onRemoveTeam: (teamSlug: string) => void;
  organization: Organization;
  /**
   * Message to display when the last team is removed
   * if empty no confirm will be displayed.
   */
  confirmLastTeamRemoveMessage?: string;
  /**
   * Allow adding to teams with org role
   * if the user is an org owner
   */
  isOrgOwner?: boolean;
  /**
   * Used to determine whether we should show a loading state while waiting for teams
   */
  loadingTeams?: boolean;
  /**
   * The OrganizationMember that we are acting on
   */
  member?: Member;
  /**
   * Optional menu header.
   */
  menuHeader?: React.ReactElement;
  /**
   * Used when showing Teams for a Member
   */
  onChangeTeamRole?: (teamSlug: string, teamRole: string) => void;
  /**
   * Used when showing Teams for a Member
   */
  selectedOrgRole?: Member['orgRole'];
  /**
   * Used when showing Teams for a Member
   */
  selectedTeamRoles?: Member['teamRoles'];
  /**
   * Used when showing Teams for a Project
   */
  selectedTeams?: Team[];
};

function TeamSelect({
  disabled,
  isOrgOwner,
  loadingTeams,
  enforceIdpProvisioned,
  member,
  menuHeader,
  confirmLastTeamRemoveMessage,
  selectedOrgRole,
  selectedTeamRoles,
  selectedTeams,
  organization,
  onAddTeam,
  onRemoveTeam,
  onChangeTeamRole,
}: Props) {
  const {teams, onSearch, fetching} = useTeams();
  const {orgRoleList, teamRoleList} = organization;

  const slugsToFilter: string[] =
    selectedTeams?.map(tm => tm.slug) || selectedTeamRoles?.map(tm => tm.teamSlug) || [];

  // Determine if adding a team changes the minimum team-role
  // Get org roles from team membership, if any
  const orgRolesFromTeams = teams
    .filter(team => slugsToFilter.includes(team.slug) && team.orgRole)
    .map(team => team.orgRole as string);

  if (selectedOrgRole) {
    orgRolesFromTeams.push(selectedOrgRole);
  }

  // Sort them and to get the highest priority role
  // Highest prio role may change minimum team role
  const effectiveOrgRole = getEffectiveOrgRole(orgRolesFromTeams, orgRoleList)?.id;

  const renderBody = () => {
    const numTeams = selectedTeams?.length || selectedTeamRoles?.length;
    if (numTeams === 0) {
      return <EmptyMessage>{t('No Teams assigned')}</EmptyMessage>;
    }

    const confirmMessage =
      numTeams === 1 && confirmLastTeamRemoveMessage
        ? confirmLastTeamRemoveMessage
        : null;

    return (
      <React.Fragment>
        {organization.features.includes('team-roles') && effectiveOrgRole && (
          <RoleOverwritePanelAlert
            orgRole={effectiveOrgRole}
            orgRoleList={orgRoleList}
            teamRoleList={teamRoleList}
          />
        )}

        {selectedTeams &&
          selectedTeams.map(team => (
            <ProjectTeamRow
              key={team.slug}
              disabled={disabled}
              confirmMessage={confirmMessage}
              organization={organization}
              team={team}
              onRemoveTeam={slug => onRemoveTeam(slug)}
            />
          ))}

        {member &&
          selectedTeamRoles &&
          /**
           * "Map + Find" operation is O(n * n), leaving it as it us because it is unlikely to cause performance issues because a Member is unlikely to be in 1000+ teams
           */
          selectedTeamRoles.map(r => {
            const team = teams.find(tm => tm.slug === r.teamSlug);
            if (!team) {
              return (
                <TeamPanelItem key={r.teamSlug}>
                  {tct(`Cannot find #[slug]`, {slug: r.teamSlug})}
                </TeamPanelItem>
              );
            }

            return (
              <MemberTeamRow
                key={r.teamSlug}
                disabled={disabled}
                enforceIdpProvisioned={enforceIdpProvisioned}
                confirmMessage={confirmMessage}
                organization={organization}
                team={team}
                member={member}
                isOrgOwner={isOrgOwner ?? false}
                onChangeTeamRole={onChangeTeamRole}
                onRemoveTeam={slug => onRemoveTeam(slug)}
              />
            );
          })}
      </React.Fragment>
    );
  };

  // Only show options that aren't selected in the dropdown
  const options = teams
    .filter(team => !slugsToFilter.some(slug => slug === team.slug))
    .map((team, index) => {
      const isIdpProvisioned = enforceIdpProvisioned && team.flags['idp:provisioned'];

      return {
        index,
        value: team.slug,
        searchKey: team.slug,
        label: () => {
          // TODO(team-roles): team admins can also manage membership
          const isPermissionGroup = team.orgRole !== null && !isOrgOwner;
          const buttonHelpText = getButtonHelpText(isIdpProvisioned, isPermissionGroup);

          if (isIdpProvisioned || isPermissionGroup) {
            return (
              <Tooltip title={buttonHelpText}>
                <DropdownTeamBadgeDisabled avatarSize={18} team={team} />
              </Tooltip>
            );
          }

          return <DropdownTeamBadge avatarSize={18} team={team} />;
        },
        disabled: disabled || isIdpProvisioned || (team.orgRole !== null && !isOrgOwner),
      };
    });

  return (
    <Panel>
      <PanelHeader hasButtons>
        {t('Team')}
        <DropdownAutoComplete
          items={options}
          busyItemsStillVisible={fetching}
          onChange={debounce<(e: React.ChangeEvent<HTMLInputElement>) => void>(
            e => onSearch(e.target.value),
            DEFAULT_DEBOUNCE_DURATION
          )}
          onSelect={(option: Item) => onAddTeam(option.value)}
          emptyMessage={t('No teams')}
          menuHeader={menuHeader}
          disabled={disabled}
          alignMenu="right"
        >
          {({isOpen}) => (
            <DropdownButton
              aria-label={t('Add Team')}
              isOpen={isOpen}
              size="xs"
              disabled={disabled}
            >
              {t('Add Team')}
            </DropdownButton>
          )}
        </DropdownAutoComplete>
      </PanelHeader>

      <PanelBody>{loadingTeams ? <LoadingIndicator /> : renderBody()}</PanelBody>
    </Panel>
  );
}

type TeamRowProps = {
  confirmMessage: string | null;
  disabled: boolean;
  onRemoveTeam: Props['onRemoveTeam'];
  organization: Organization;
  team: Team;
};

type ProjectTeamRowProps = {} & TeamRowProps;

/**
 * Used on ProjectTeam page to add/remove Teams from Project
 * http://default.dev.getsentry.net:8000/settings/projects/earth/teams/
 */
function ProjectTeamRow({
  organization,
  team,
  onRemoveTeam,
  disabled,
  confirmMessage,
}: ProjectTeamRowProps) {
  return (
    <TeamPanelItem data-test-id="team-row-for-project">
      <StyledLink to={`/settings/${organization.slug}/teams/${team.slug}/`}>
        <TeamBadge team={team} />
      </StyledLink>

      <Confirm
        message={confirmMessage}
        bypass={!confirmMessage}
        onConfirm={() => onRemoveTeam(team.slug)}
        disabled={disabled}
      >
        <Button size="xs" icon={<IconSubtract isCircled size="xs" />} disabled={disabled}>
          {t('Remove')}
        </Button>
      </Confirm>
    </TeamPanelItem>
  );
}

type MemberTeamRowProps = {
  enforceIdpProvisioned: boolean;
  isOrgOwner: boolean;
  member: Member;
  onChangeTeamRole: Props['onChangeTeamRole'];
} & TeamRowProps;

/**
 * Used on OrgMemberDetails page to add/remove Teams from Member
 * http://default.dev.getsentry.net:8000/settings/members/1/
 */
function MemberTeamRow({
  organization,
  team,
  member,
  onRemoveTeam,
  onChangeTeamRole,
  isOrgOwner,
  disabled,
  confirmMessage,
  enforceIdpProvisioned,
}: MemberTeamRowProps) {
  const orgRoleFromTeam = team.orgRole ? `${startCase(team.orgRole)} Team` : null;

  const isIdpProvisioned = enforceIdpProvisioned && team.flags['idp:provisioned'];
  const isPermissionGroup = team.orgRole !== null && !isOrgOwner;
  const isRemoveDisabled = disabled || isIdpProvisioned || isPermissionGroup;

  const buttonHelpText = getButtonHelpText(isIdpProvisioned, isPermissionGroup);

  return (
    <TeamPanelItem data-test-id="team-row-for-member">
      <StyledLink to={`/settings/${organization.slug}/teams/${team.slug}/`}>
        <TeamBadge team={team} />
      </StyledLink>

      <TeamOrgRole>{orgRoleFromTeam}</TeamOrgRole>

      {organization.features.includes('team-roles') && onChangeTeamRole && (
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

      <Confirm
        message={confirmMessage}
        bypass={!confirmMessage}
        onConfirm={() => onRemoveTeam(team.slug)}
        disabled={isRemoveDisabled}
      >
        <Button
          size="xs"
          icon={<IconSubtract isCircled size="xs" />}
          title={buttonHelpText}
        >
          {t('Remove')}
        </Button>
      </Confirm>
    </TeamPanelItem>
  );
}

const DropdownTeamBadge = styled(TeamBadge)`
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeMedium};
  text-transform: none;
`;

const DropdownTeamBadgeDisabled = styled(TeamBadge)`
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeMedium};
  text-transform: none;
  filter: grayscale(1);
`;

const TeamPanelItem = styled(PanelItem)`
  padding: ${space(2)};
  align-items: center;
  justify-content: space-between;
`;

const StyledLink = styled(Link)`
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
