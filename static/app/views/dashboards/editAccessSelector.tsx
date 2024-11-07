import {useState} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import AvatarList from 'sentry/components/avatar/avatarList';
import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import Badge from 'sentry/components/badge/badge';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import {CheckWrap} from 'sentry/components/compactSelect/styles';
import UserBadge from 'sentry/components/idBadge/userBadge';
import {InnerWrap, LeadingItems} from 'sentry/components/menuListItem';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import {useUser} from 'sentry/utils/useUser';
import type {DashboardDetails, DashboardPermissions} from 'sentry/views/dashboards/types';

interface EditAccessSelectorProps {
  dashboard: DashboardDetails;
  onChangeEditAccess?: (newDashboardPermissions: DashboardPermissions) => void;
}

/**
 * Dropdown multiselect button to enable selective Dashboard editing access to
 * specific users and teams
 */
function EditAccessSelector({dashboard, onChangeEditAccess}: EditAccessSelectorProps) {
  const currentUser: User = useUser();
  const dashboardCreator: User | undefined = dashboard.createdBy;
  const isCurrentUserDashboardOwner = dashboardCreator?.id === currentUser.id;
  const {teams} = useTeamsById();
  const teamIds: string[] = Object.values(teams).map(team => team.id);
  const [selectedOptions, setSelectedOptions] = useState<string[]>(getSelectedOptions());
  const [isMenuOpen, setMenuOpen] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Handles state change when dropdown options are selected
  const onSelectOptions = newSelectedOptions => {
    let newSelectedValues = newSelectedOptions.map(
      (option: {value: string}) => option.value
    );
    const areAllTeamsSelected = teamIds.every(teamId =>
      newSelectedValues.includes(teamId)
    );
    const isAllUsersOptionSelected = selectedOptions.includes('_allUsers');

    if (!isAllUsersOptionSelected && newSelectedValues.includes('_allUsers')) {
      newSelectedValues = ['_creator', '_allUsers', ...teamIds];
    } else if (isAllUsersOptionSelected && !newSelectedValues.includes('_allUsers')) {
      newSelectedValues = ['_creator'];
    } else if (!areAllTeamsSelected) {
      newSelectedValues = newSelectedValues.filter(value => value !== '_allUsers');
    } else if (areAllTeamsSelected) {
      newSelectedValues = ['_creator', '_allUsers', ...teamIds];
    }

    setSelectedOptions(newSelectedValues);
  };

  // Creates a permissions object based on the options selected
  function getDashboardPermissions() {
    return {
      isEditableByEveryone: selectedOptions.includes('_allUsers'),
      teamsWithEditAccess: selectedOptions.includes('_allUsers')
        ? undefined
        : selectedOptions
            .filter(option => option !== '_creator')
            .map(teamId => parseInt(teamId, 10)),
    };
  }

  // memo?
  function getSelectedOptions(): string[] {
    if (!defined(dashboard.permissions) || dashboard.permissions.isEditableByEveryone) {
      return ['_creator', '_allUsers', ...teamIds];
    }
    const permittedTeamIds =
      dashboard.permissions.teamsWithEditAccess?.map(teamId => String(teamId)) ?? [];
    return ['_creator', ...permittedTeamIds];
  }

  // Dashboard creator option in the dropdown
  const makeCreatorOption = () => ({
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
  });

  // Single team option in the dropdown
  const makeTeamOption = (team: Team) => ({
    value: team.id,
    label: `#${team.slug}`,
    leadingItems: <TeamAvatar team={team} size={18} />,
  });

  // Avatars/Badges in the Edit Access Selector Button
  const triggerAvatars =
    selectedOptions.includes('_allUsers') || !dashboardCreator ? (
      <StyledBadge key="_all" text={'All'} />
    ) : (
      <StyledAvatarList
        key="avatar-list"
        typeAvatars="users"
        users={Array(selectedOptions.length === 2 ? 1 : selectedOptions.length).fill(
          dashboardCreator
        )}
        teams={
          selectedOptions.length === 2
            ? selectedOptions
                .filter(option => option !== '_creator')
                .map(option => teams.find(team => team.id === option))
                .filter((team): team is Team => team !== undefined)
            : []
        }
        maxVisibleAvatars={1}
        avatarSize={25}
      />
    );

  const allDropdownOptions = [
    makeCreatorOption(),
    {
      value: '_sall_user_section',
      options: [
        {
          value: '_allUsers',
          label: t('All users'),
          disabled: !isCurrentUserDashboardOwner,
        },
      ],
    },
    {
      value: '_teams',
      label: t('Teams'),
      options: teams.map(makeTeamOption),
      showToggleAllButton: isCurrentUserDashboardOwner,
      disabled: !isCurrentUserDashboardOwner,
    },
  ];

  // Save and Cancel Buttons
  const dropdownFooterButtons = (
    <FilterButtons>
      <Button
        size="sm"
        onClick={() => {
          setMenuOpen(false);
        }}
        disabled={!isCurrentUserDashboardOwner}
      >
        {t('Cancel')}{' '}
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
        disabled={!isCurrentUserDashboardOwner || !hasUnsavedChanges}
      >
        {t('Save Changes')}
      </Button>
    </FilterButtons>
  );

  const dropdownMenu = (
    <StyledCompactSelect
      size="sm"
      onChange={newSelectedOptions => {
        onSelectOptions(newSelectedOptions);
        setHasUnsavedChanges(true);
      }}
      multiple
      searchable
      options={allDropdownOptions}
      value={selectedOptions}
      triggerLabel={[t('Edit Access:'), triggerAvatars]}
      searchPlaceholder={t('Search Teams')}
      isOpen={isMenuOpen}
      onOpenChange={() => {
        setSelectedOptions(getSelectedOptions());
        setMenuOpen(!isMenuOpen);
        setHasUnsavedChanges(false);
      }}
      menuFooter={dropdownFooterButtons}
    />
  );

  return isCurrentUserDashboardOwner ? (
    dropdownMenu
  ) : (
    <Tooltip title={t('Only the creator of the dashboard can edit permissions')}>
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
`;

const StyledBadge = styled(Badge)`
  color: ${p => p.theme.white};
  background: ${p => p.theme.purple300};
  margin-right: 3px;
  padding: 0;
  height: 20px;
  width: 20px;
`;

const FilterButtons = styled(ButtonBar)`
  display: grid;
  gap: ${space(1.5)};
  margin-top: ${space(0.5)};
  margin-bottom: ${space(0.5)};
  justify-content: flex-end;
`;
