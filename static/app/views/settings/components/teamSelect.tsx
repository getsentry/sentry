import React from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

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
import RoleSelectControl from 'sentry/components/roleSelectControl';
import {Tooltip} from 'sentry/components/tooltip';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {IconSubtract} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Member, Organization, Team} from 'sentry/types';
import useTeams from 'sentry/utils/useTeams';
import {
  hasOrgRoleOverwrite,
  RoleOverwritePanelAlert,
} from 'sentry/views/settings/organizationTeams/roleOverwriteWarning';

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
   * Used to determine whether we should show a loading state while waiting for teams
   */
  loadingTeams?: boolean;
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
  loadingTeams,
  enforceIdpProvisioned,
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
        {organization.features.includes('team-roles') && selectedOrgRole && (
          <RoleOverwritePanelAlert
            orgRole={selectedOrgRole}
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

        {selectedOrgRole &&
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
                selectedOrgRole={selectedOrgRole}
                selectedTeamRole={r.role}
                onChangeTeamRole={onChangeTeamRole}
                onRemoveTeam={slug => onRemoveTeam(slug)}
              />
            );
          })}
      </React.Fragment>
    );
  };

  const slugsToFilter =
    selectedTeams?.map(tm => tm.slug) || selectedTeamRoles?.map(tm => tm.teamSlug) || [];

  // Only show options that aren't selected in the dropdown
  const options = teams
    .filter(team => !slugsToFilter.some(slug => slug === team.slug))
    .map((team, index) => ({
      index,
      value: team.slug,
      searchKey: team.slug,
      label: () => {
        if (enforceIdpProvisioned && team.flags['idp:provisioned']) {
          return (
            <Tooltip
              title={t(
                "Membership to this team is managed through your organization's identity provider."
              )}
            >
              <DropdownTeamBadgeDisabled avatarSize={18} team={team} />
            </Tooltip>
          );
        }
        return <DropdownTeamBadge avatarSize={18} team={team} />;
      },
      disabled: enforceIdpProvisioned && team.flags['idp:provisioned'],
    }));

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

const ProjectTeamRow = ({
  organization,
  team,
  onRemoveTeam,
  disabled,
  confirmMessage,
}: ProjectTeamRowProps) => (
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

type MemberTeamRowProps = {
  enforceIdpProvisioned: boolean;
  onChangeTeamRole: Props['onChangeTeamRole'];
  selectedOrgRole: Member['orgRole'];
  selectedTeamRole: Member['teamRoles'][0]['role'];
} & TeamRowProps;

const MemberTeamRow = ({
  organization,
  team,
  selectedOrgRole,
  selectedTeamRole,
  onRemoveTeam,
  onChangeTeamRole,
  disabled,
  confirmMessage,
  enforceIdpProvisioned,
}: MemberTeamRowProps) => {
  const {teamRoleList, orgRoleList} = organization;
  const isRoleOverwritten = hasOrgRoleOverwrite({
    orgRole: selectedOrgRole,
    orgRoleList,
    teamRoleList,
  });

  const teamRoleObj = isRoleOverwritten
    ? teamRoleList[1] // set as team admin
    : teamRoleList.find(r => r.id === selectedTeamRole) || teamRoleList[0];

  return (
    <TeamPanelItem data-test-id="team-row-for-member">
      <StyledLink to={`/settings/${organization.slug}/teams/${team.slug}/`}>
        <TeamBadge team={team} />
      </StyledLink>

      {organization.features.includes('team-roles') && onChangeTeamRole && (
        <React.Fragment>
          <StyledRoleSelectControl
            disabled={disabled || isRoleOverwritten}
            disableUnallowed={false}
            size="xs"
            roles={teamRoleList}
            value={teamRoleObj?.id}
            onChange={option => onChangeTeamRole(team.slug, option.value)}
          />
        </React.Fragment>
      )}

      <Confirm
        message={confirmMessage}
        bypass={!confirmMessage}
        onConfirm={() => onRemoveTeam(team.slug)}
        disabled={disabled || (enforceIdpProvisioned && team.flags['idp:provisioned'])}
      >
        <Button
          size="xs"
          icon={<IconSubtract isCircled size="xs" />}
          disabled={disabled || (enforceIdpProvisioned && team.flags['idp:provisioned'])}
          title={
            enforceIdpProvisioned && team.flags['idp:provisioned']
              ? t(
                  "Membership to this team is managed through your organization's identity provider."
                )
              : undefined
          }
        >
          {t('Remove')}
        </Button>
      </Confirm>
    </TeamPanelItem>
  );
};

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
  flex-grow: 1;
`;

const StyledRoleSelectControl = styled(RoleSelectControl)`
  min-width: 200px;
  margin-right: ${space(2)};
`;

export default TeamSelect;
