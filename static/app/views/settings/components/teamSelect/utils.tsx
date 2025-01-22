import {css} from '@emotion/react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {openCreateTeamModal} from 'sentry/actionCreators/modal';
import {hasEveryAccess} from 'sentry/components/acl/access';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import type {Item, ItemsBeforeFilter} from 'sentry/components/dropdownAutoComplete/types';
import DropdownButton from 'sentry/components/dropdownButton';
import {TeamBadge} from 'sentry/components/idBadge/teamBadge';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {getButtonHelpText} from 'sentry/views/settings/organizationTeams/utils';

export type TeamSelectProps = {
  /**
   * Should button be disabled
   */
  disabled: boolean;
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
   * Used to determine whether we should show a loading state while waiting for teams
   */
  loadingTeams?: boolean;
  /**
   * Callback when teams are created
   */
  onCreateTeam?: (team: Team) => void;
};

export function DropdownAddTeam({
  disabled,
  isLoadingTeams,
  isAddingTeamToMember = false,
  isAddingTeamToProject = false,
  onSearch,
  onSelect,
  onCreateTeam,
  organization,
  selectedTeams,
  teams,
  project,
}: {
  disabled: boolean;
  isLoadingTeams: boolean;
  onSearch: (teamSlug: string) => void;
  onSelect: (teamSlug: string) => void;
  organization: Organization;
  selectedTeams: string[];
  teams: Team[];
  canCreateTeam?: boolean;
  isAddingTeamToMember?: boolean;
  isAddingTeamToProject?: boolean;
  onCreateTeam?: (team: Team) => void;
  project?: Project;
}) {
  const dropdownItems: ItemsBeforeFilter = teams
    .filter(team => !selectedTeams.some(slug => slug === team.slug))
    .map((team, index) =>
      getDropdownOption({
        isAddingTeamToMember,
        isAddingTeamToProject,
        team,
        index,
        disabled,
      })
    );

  const onDropdownChange = debounce<(e: React.ChangeEvent<HTMLInputElement>) => void>(
    e => onSearch(e.target.value),
    DEFAULT_DEBOUNCE_DURATION
  );

  return (
    <DropdownAutoComplete
      items={dropdownItems}
      busyItemsStillVisible={isLoadingTeams}
      onChange={onDropdownChange}
      onSelect={(option: Item) => onSelect(option.value)}
      emptyMessage={t('No teams')}
      menuHeader={renderDropdownHeader({
        organization,
        project,
        onCreateTeam,
      })}
      disabled={disabled}
      alignMenu="right"
    >
      {({isOpen}) => (
        <DropdownButton isOpen={isOpen} size="xs" disabled={disabled}>
          {t('Add Team')}
        </DropdownButton>
      )}
    </DropdownAutoComplete>
  );
}

function getDropdownOption({
  disabled,
  index,
  isAddingTeamToMember,
  team,
}: {
  disabled: boolean;
  index: number;
  isAddingTeamToMember: boolean;
  isAddingTeamToProject: boolean;
  team: Team;
}): ItemsBeforeFilter[number] {
  const isIdpProvisioned = isAddingTeamToMember && team.flags['idp:provisioned'];
  const label = isIdpProvisioned ? (
    <Tooltip title={getButtonHelpText(isIdpProvisioned)}>
      <DropdownTeamBadgeDisabled avatarSize={18} team={team} />
    </Tooltip>
  ) : (
    <DropdownTeamBadge avatarSize={18} team={team} />
  );

  return {
    index,
    value: team.slug,
    searchKey: team.slug,
    label,
    disabled: disabled || isIdpProvisioned,
  };
}

function renderDropdownHeader({
  organization,
  project,
  onCreateTeam,
}: {
  organization: Organization;
  onCreateTeam?: (team: any) => void;
  project?: Project;
}) {
  const canCreateTeam = hasEveryAccess(['org:write'], {organization, project});

  return (
    <StyledTeamsLabel>
      <span>{t('Teams')}</span>

      <Tooltip
        disabled={canCreateTeam}
        title={t('You must be a Org Owner/Manager to create teams')}
        position="top"
      >
        <StyledCreateTeamLink
          to="#create-team"
          disabled={!canCreateTeam}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();

            openCreateTeamModal({
              organization,
              project,
              onClose: onCreateTeam,
            });
          }}
        >
          {t('Create Team')}
        </StyledCreateTeamLink>
      </Tooltip>
    </StyledTeamsLabel>
  );
}

const DropdownTeamBadge = styled(TeamBadge)`
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeMedium};
  text-transform: none;
`;

const DropdownTeamBadgeDisabled = styled(TeamBadge)`
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeMedium};
  text-transform: none;
  filter: grayscale(1);
`;

const StyledTeamsLabel = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  font-size: 0.875em;
  padding: ${space(0.5)} 0px;
  text-transform: uppercase;
`;

const StyledCreateTeamLink = styled(Link)`
  float: right;
  text-transform: none;
  ${p =>
    p.disabled &&
    css`
      cursor: not-allowed;
      color: ${p.theme.gray300};
      opacity: 0.6;
    `};
`;
