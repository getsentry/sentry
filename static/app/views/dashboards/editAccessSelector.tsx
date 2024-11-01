import {useState} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import AvatarList from 'sentry/components/avatar/avatarList';
import Badge from 'sentry/components/badge/badge';
import Checkbox from 'sentry/components/checkbox';
import {CompactSelect} from 'sentry/components/compactSelect';
import {CheckWrap} from 'sentry/components/compactSelect/styles';
import UserBadge from 'sentry/components/idBadge/userBadge';
import {InnerWrap, LeadingItems} from 'sentry/components/menuListItem';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
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
  const {teams} = useTeamsById();
  const teamIds: string[] = Object.values(teams).map(team => team.id);
  const [selectedOptions, setselectedOptions] = useState<string[]>(
    dashboard.permissions?.isCreatorOnlyEditable
      ? ['_creator']
      : ['_everyone', '_creator', ...teamIds]
  );
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
    disabled: dashboardCreator?.id !== currentUser.id,
    // Creator option is always disabled
    leadingItems: <Checkbox size="sm" checked disabled />,
    hideCheck: true,
  });

  // Single team option in the dropdown [WIP]
  // const makeTeamOption = (team: Team) => ({
  //   value: team.id,
  //   label: `#${team.slug}`,
  //   leadingItems: <TeamAvatar team={team} size={18} />,
  // });

  // Avatars/Badges in the Edit Selector Button
  const triggerAvatars =
    selectedOptions.includes('_everyone') || !dashboardCreator ? (
      <StyledBadge key="_all" text={'All'} />
    ) : (
      <StyledAvatarList key="avatar-list" users={[dashboardCreator]} avatarSize={25} />
    );

  const dropdownOptions = [
    makeCreatorOption(),
    {
      value: '_everyone_section',
      options: [
        {
          value: '_everyone',
          label: t('Everyone'),
          disabled: dashboardCreator?.id !== currentUser.id,
        },
      ],
    },
    // [WIP: Selective edit access to teams]
    // {
    //   value: '_teams',
    //   label: t('Teams'),
    //   options: teams.map(makeTeamOption),
    //   showToggleAllButton: true,
    //   disabled: true,
    // },
  ];

  // Handles state change when dropdown options are selected
  const onSelectOptions = newSelectedOptions => {
    const newSelectedValues = newSelectedOptions.map(
      (option: {value: string}) => option.value
    );
    if (newSelectedValues.includes('_everyone')) {
      setselectedOptions(['_everyone', '_creator', ...teamIds]);
    } else if (!newSelectedValues.includes('_everyone')) {
      setselectedOptions(['_creator']);
    }
  };

  // Creates or modifies permissions object based on the options selected
  function getDashboardPermissions() {
    return {
      isCreatorOnlyEditable: !selectedOptions.includes('_everyone'),
    };
  }

  const dropdownMenu = (
    <StyledCompactSelect
      size="sm"
      onChange={newSelectedOptions => {
        onSelectOptions(newSelectedOptions);
      }}
      onClose={() => {
        const isDefaultState =
          !defined(dashboard.permissions) && selectedOptions.includes('_everyone');
        const newDashboardPermissions = getDashboardPermissions();
        if (!isDefaultState && !isEqual(newDashboardPermissions, dashboard.permissions)) {
          onChangeEditAccess?.(newDashboardPermissions);
        }
      }}
      multiple
      searchable
      options={dropdownOptions}
      value={selectedOptions}
      triggerLabel={[t('Edit Access:'), triggerAvatars]}
      searchPlaceholder={t('Search Teams')}
    />
  );

  return dashboardCreator?.id !== currentUser.id ? (
    <Tooltip title={t('Only Dashboard Creator may change Edit Access')}>
      {dropdownMenu}
    </Tooltip>
  ) : (
    dropdownMenu
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
`;
