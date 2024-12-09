import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';

import {hasEveryAccess} from 'sentry/components/acl/access';
import AvatarList from 'sentry/components/avatar/avatarList';
import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import Badge from 'sentry/components/badge/badge';
import FeatureBadge from 'sentry/components/badge/featureBadge';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import {CheckWrap} from 'sentry/components/compactSelect/styles';
import UserBadge from 'sentry/components/idBadge/userBadge';
import {InnerWrap, LeadingItems} from 'sentry/components/menuListItem';
import {Tooltip} from 'sentry/components/tooltip';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';
import {useTeams} from 'sentry/utils/useTeams';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import {useUser} from 'sentry/utils/useUser';
import type {
  DashboardDetails,
  DashboardListItem,
  DashboardPermissions,
} from 'sentry/views/dashboards/types';

interface EditAccessSelectorProps {
  dashboard: DashboardDetails | DashboardListItem;
  listOnly?: boolean;
  onChangeEditAccess?: (newDashboardPermissions: DashboardPermissions) => void;
}

/**
 * Dropdown multiselect button to enable selective Dashboard editing access to
 * specific users and teams
 */
function EditAccessSelector({
  dashboard,
  onChangeEditAccess,
  listOnly = false,
}: EditAccessSelectorProps) {
  const currentUser: User = useUser();
  const dashboardCreator: User | undefined = dashboard.createdBy;

  const organization = useOrganization();
  const userCanEditDashboardPermissions =
    dashboardCreator?.id === currentUser.id ||
    hasEveryAccess(['org:write'], {organization});

  // Retrieves teams from the team store, which may contain only a subset of all teams
  const {teams: teamsToRender} = useTeamsById();
  const {onSearch} = useTeams();
  const teamIds: string[] = Object.values(teamsToRender).map(team => team.id);

  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [stagedOptions, setStagedOptions] = useState<string[]>([]);
  const [isMenuOpen, setMenuOpen] = useState<boolean>(false);
  const {teams: selectedTeam} = useTeamsById({
    ids:
      selectedOptions[1] && selectedOptions[1] !== 'allUsers' ? [selectedOptions[1]] : [],
  });

  // Gets selected options for the dropdown from dashboard object
  useEffect(() => {
    const teamIdsList: string[] = Object.values(teamsToRender).map(team => team.id);
    const selectedOptionsFromDashboard =
      !defined(dashboard.permissions) || dashboard.permissions.isEditableByEveryone
        ? ['_creator', '_allUsers', ...teamIdsList]
        : [
            '_creator',
            ...(dashboard.permissions.teamsWithEditAccess?.map(teamId =>
              String(teamId)
            ) ?? []),
          ];
    setSelectedOptions(selectedOptionsFromDashboard);
  }, [dashboard, teamsToRender, isMenuOpen]); // isMenuOpen dependency ensures perms are 'refreshed'

  // Handles state change when dropdown options are selected
  const onSelectOptions = newSelectedOptions => {
    let newSelectedValues = newSelectedOptions.map(
      (option: {value: string}) => option.value
    );
    const areAllTeamsSelected = teamIds.every(teamId =>
      newSelectedValues.includes(teamId)
    );

    if (
      !selectedOptions.includes('_allUsers') &&
      newSelectedValues.includes('_allUsers')
    ) {
      newSelectedValues = ['_creator', '_allUsers', ...teamIds];
    } else if (
      selectedOptions.includes('_allUsers') &&
      !newSelectedValues.includes('_allUsers')
    ) {
      newSelectedValues = ['_creator'];
    } else {
      areAllTeamsSelected
        ? // selecting all teams deselects 'all users'
          (newSelectedValues = ['_creator', '_allUsers', ...teamIds])
        : // deselecting any team deselects 'all users'
          (newSelectedValues = newSelectedValues.filter(value => value !== '_allUsers'));
    }

    setSelectedOptions(newSelectedValues);
  };

  // Creates a permissions object based on the options selected
  function getDashboardPermissions() {
    return {
      isEditableByEveryone: selectedOptions.includes('_allUsers'),
      teamsWithEditAccess: selectedOptions.includes('_allUsers')
        ? []
        : selectedOptions
            .filter(option => option !== '_creator')
            .map(teamId => parseInt(teamId, 10))
            .sort((a, b) => a - b),
    };
  }

  const makeCreatorOption = useCallback(
    () => ({
      value: '_creator',
      label: (
        <UserBadge
          avatarSize={18}
          user={dashboardCreator}
          displayName={
            <StyledDisplayName>
              {dashboardCreator?.id === currentUser.id
                ? tct('You ([email])', {email: currentUser.email})
                : dashboardCreator?.email ||
                  tct('You ([email])', {email: currentUser.email})}
            </StyledDisplayName>
          }
          displayEmail={t('Creator')}
        />
      ),
      textValue: `creator_${currentUser.email}`,
      disabled: true,
    }),
    [dashboardCreator, currentUser]
  );

  // Single team option in the dropdown
  const makeTeamOption = (team: Team) => ({
    value: team.id,
    label: `#${team.slug}`,
    leadingItems: <TeamAvatar team={team} size={18} />,
  });

  // Avatars/Badges in the Edit Access Selector Button
  const triggerAvatars =
    selectedOptions.includes('_allUsers') || !dashboardCreator ? (
      <StyledBadge key="_all" text={'All'} size={listOnly ? 26 : 20} />
    ) : selectedOptions.length === 2 ? (
      // Case where we display 1 Creator Avatar + 1 Team Avatar
      <StyledAvatarList
        key="avatar-list-2-badges"
        typeAvatars="users"
        users={[dashboardCreator]}
        teams={selectedTeam ? selectedTeam : []}
        maxVisibleAvatars={1}
        avatarSize={listOnly ? 30 : 25}
        renderUsersFirst
        tooltipOptions={{disabled: !userCanEditDashboardPermissions}}
      />
    ) : (
      // Case where we display 1 Creator Avatar + a Badge with no. of teams selected
      <StyledAvatarList
        key="avatar-list-many-teams"
        typeAvatars="users"
        users={Array(selectedOptions.length).fill(dashboardCreator)}
        maxVisibleAvatars={1}
        avatarSize={listOnly ? 30 : 25}
        tooltipOptions={{disabled: !userCanEditDashboardPermissions}}
      />
    );

  // Sorting function for team options
  const listSort = useCallback(
    (team: Team) => [
      !stagedOptions.includes(team.id), // selected teams are shown first
      team.slug, // sort rest alphabetically
    ],
    [stagedOptions]
  );

  const allDropdownOptions = useMemo(
    () => [
      makeCreatorOption(),
      {
        value: '_all_users_section',
        options: [
          {
            value: '_allUsers',
            label: t('All users'),
            disabled: !userCanEditDashboardPermissions,
          },
        ],
      },
      {
        value: '_teams',
        label: t('Teams'),
        options: sortBy(teamsToRender, listSort).map(makeTeamOption),
        showToggleAllButton: userCanEditDashboardPermissions,
        disabled: !userCanEditDashboardPermissions,
      },
    ],
    [userCanEditDashboardPermissions, teamsToRender, makeCreatorOption, listSort]
  );

  // Save and Cancel Buttons
  const dropdownFooterButtons = (
    <FilterButtons>
      <Button
        size="sm"
        onClick={() => {
          setMenuOpen(false);
        }}
        disabled={!userCanEditDashboardPermissions}
      >
        {t('Cancel')}
      </Button>
      <Button
        size="sm"
        onClick={() => {
          const isDefaultState =
            !defined(dashboard.permissions) && selectedOptions.includes('_allUsers');
          const newDashboardPermissions = getDashboardPermissions();
          if (
            !isDefaultState &&
            !isEqual(newDashboardPermissions, dashboard.permissions)
          ) {
            onChangeEditAccess?.(newDashboardPermissions);
          }
          setMenuOpen(!isMenuOpen);
        }}
        priority="primary"
        disabled={
          !userCanEditDashboardPermissions ||
          isEqual(getDashboardPermissions(), {
            ...dashboard.permissions,
            teamsWithEditAccess: dashboard.permissions?.teamsWithEditAccess?.sort(
              (a, b) => a - b
            ),
          })
        }
      >
        {t('Save Changes')}
      </Button>
    </FilterButtons>
  );

  const dropdownMenu = (
    <StyledCompactSelect
      data-test-id={'edit-access-dropdown'}
      size="sm"
      onChange={newSelectedOptions => {
        onSelectOptions(newSelectedOptions);
      }}
      multiple
      searchable
      options={allDropdownOptions}
      value={selectedOptions}
      triggerLabel={
        listOnly
          ? [triggerAvatars]
          : [
              <StyledFeatureBadge
                key="new-badge"
                type="new"
                tooltipProps={{position: 'left', delay: 1000, isHoverable: true}}
              />,
              t('Edit Access:'),
              triggerAvatars,
            ]
      }
      triggerProps={{borderless: listOnly}}
      searchPlaceholder={t('Search Teams')}
      isOpen={isMenuOpen}
      onOpenChange={() => {
        setStagedOptions(selectedOptions);
        setMenuOpen(!isMenuOpen);
      }}
      menuFooter={dropdownFooterButtons}
      onSearch={debounce(val => void onSearch(val), DEFAULT_DEBOUNCE_DURATION)}
    />
  );

  return (
    <Tooltip
      title={t('Only the creator of the dashboard can edit permissions')}
      disabled={userCanEditDashboardPermissions || isMenuOpen}
    >
      {dropdownMenu}
    </Tooltip>
  );
}

export default EditAccessSelector;

const StyledCompactSelect = styled(CompactSelect)`
  ${InnerWrap} {
    align-items: center;
  }

  ${LeadingItems} {
    margin-top: 0;
  }

  ${CheckWrap} {
    padding-bottom: 0;
  }
`;

const StyledDisplayName = styled('div')`
  font-weight: normal;
`;

const StyledAvatarList = styled(AvatarList)`
  margin-left: 10px;
  margin-right: -3px;
`;

const StyledFeatureBadge = styled(FeatureBadge)`
  margin-left: 0px;
  margin-right: 6px;
`;

const StyledBadge = styled(Badge)<{size: number}>`
  color: ${p => p.theme.white};
  background: ${p => p.theme.purple300};
  padding: 0;
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const FilterButtons = styled(ButtonBar)`
  display: grid;
  gap: ${space(1.5)};
  margin-top: ${space(0.5)};
  margin-bottom: ${space(0.5)};
  justify-content: flex-end;
`;
