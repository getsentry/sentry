import {useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';

import {hasEveryAccess} from 'sentry/components/acl/access';
import Avatar from 'sentry/components/avatar';
import AvatarList, {CollapsedAvatars} from 'sentry/components/avatar/avatarList';
import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import {CheckWrap} from 'sentry/components/compactSelect/styles';
import {Badge} from 'sentry/components/core/badge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import {InnerWrap, LeadingItems} from 'sentry/components/menuListItem';
import {Tooltip} from 'sentry/components/tooltip';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
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
  const [isCollapsedAvatarTooltipOpen, setIsCollapsedAvatarTooltipOpen] =
    useState<boolean>(false);
  const {teams: selectedTeam} = useTeamsById({
    ids:
      selectedOptions[1] && selectedOptions[1] !== '_allUsers'
        ? [selectedOptions[1]]
        : [],
  });
  const {teams: allSelectedTeams} = useTeamsById({
    ids: selectedOptions.filter(
      option => option !== '_allUsers' && option !== '_creator'
    ),
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
  const onSelectOptions = (newSelectedOptions: any) => {
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
      if (areAllTeamsSelected) {
        // selecting all teams deselects 'all users'
        newSelectedValues = ['_creator', '_allUsers', ...teamIds];
      } else {
        // deselecting any team deselects 'all users'
        newSelectedValues = newSelectedValues.filter(
          (value: any) => value !== '_allUsers'
        );
      }
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

  // Creates tooltip for the + bubble in avatar list
  const renderCollapsedAvatarTooltip = () => {
    const permissions = getDashboardPermissions();
    if (permissions.teamsWithEditAccess.length > 1) {
      return (
        <CollapsedAvatarTooltip>
          {allSelectedTeams.map((team, index) => (
            <CollapsedAvatarTooltipListItem
              key={team.id}
              style={{
                marginBottom: index === allSelectedTeams.length - 1 ? 0 : space(1),
              }}
            >
              <Avatar team={team} size={18} />
              <div>#{team.name}</div>
            </CollapsedAvatarTooltipListItem>
          ))}
        </CollapsedAvatarTooltip>
      );
    }
    return null;
  };

  const renderCollapsedAvatars = (avatarSize: number, numCollapsedAvatars: number) => {
    return (
      <Tooltip
        title={renderCollapsedAvatarTooltip()}
        isHoverable
        overlayStyle={{
          pointerEvents: 'auto',
          zIndex: 1000,
        }}
      >
        <div
          onMouseEnter={() => setIsCollapsedAvatarTooltipOpen(true)}
          onMouseLeave={() => setIsCollapsedAvatarTooltipOpen(false)}
        >
          <CollapsedAvatars size={avatarSize}>
            {numCollapsedAvatars < 99 && <Plus>+</Plus>}
            {numCollapsedAvatars}
          </CollapsedAvatars>
        </div>
      </Tooltip>
    );
  };

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
      <StyledBadge key="_all" size={listOnly ? 26 : 20} type="default">
        {t('All')}
      </StyledBadge>
    ) : selectedOptions.length === 2 ? (
      // Case where we display 1 Creator Avatar + 1 Team Avatar
      <StyledAvatarList
        listonly={listOnly}
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
        listonly={listOnly}
        typeAvatars="users"
        users={Array(selectedOptions.length).fill(dashboardCreator)}
        maxVisibleAvatars={1}
        avatarSize={listOnly ? 30 : 25}
        tooltipOptions={{disabled: !userCanEditDashboardPermissions}}
        renderCollapsedAvatars={renderCollapsedAvatars}
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
            trackAnalytics('dashboards2.edit_access.save', {
              organization,
              editable_by: newDashboardPermissions.isEditableByEveryone
                ? 'all'
                : newDashboardPermissions.teamsWithEditAccess.length > 0
                  ? 'team_selection'
                  : 'owner_only',
              team_count: newDashboardPermissions.teamsWithEditAccess.length || undefined,
            });

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
              <LabelContainer key="selector-label">{t('Edit Access:')}</LabelContainer>,
              triggerAvatars,
            ]
      }
      triggerProps={{borderless: listOnly, style: listOnly ? {padding: 2} : {}}}
      searchPlaceholder={t('Search Teams')}
      isOpen={isMenuOpen}
      onOpenChange={newOpenState => {
        if (newOpenState === true) {
          trackAnalytics('dashboards2.edit_access.start', {organization});
        }

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
      disabled={
        userCanEditDashboardPermissions || isMenuOpen || isCollapsedAvatarTooltipOpen
      }
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

const StyledAvatarList = styled(AvatarList)<{listonly: boolean}>`
  margin-left: ${space(0.75)};
  margin-right: ${p => (p.listonly ? 0 : -3)}px;
  font-weight: normal;
`;

const LabelContainer = styled('div')`
  margin-right: ${space(1)};
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
  margin-left: 0px;
`;

const FilterButtons = styled(ButtonBar)`
  display: grid;
  gap: ${space(1.5)};
  margin-top: ${space(0.5)};
  margin-bottom: ${space(0.5)};
  justify-content: flex-end;
`;

const CollapsedAvatarTooltip = styled('div')`
  max-height: 200px;
  overflow-y: auto;
`;

const CollapsedAvatarTooltipListItem = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const Plus = styled('span')`
  font-size: 10px;
  margin-left: 1px;
  margin-right: -1px;
`;
