import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import AvatarList from 'sentry/components/avatar/avatarList';
import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import {CompactSelect} from 'sentry/components/compactSelect';
import {CheckWrap} from 'sentry/components/compactSelect/styles';
import UserBadge from 'sentry/components/idBadge/userBadge';
import {InnerWrap, LeadingItems} from 'sentry/components/menuListItem';
import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import {useUser} from 'sentry/utils/useUser';
import type {DashboardDetails, DashboardPermissions} from 'sentry/views/dashboards/types';

interface EditAccessSelectorProps {
  dashboard: DashboardDetails;
  onChangeEditAccess: (newDashboardPermissions: DashboardPermissions) => void;
  dashboardPermissions?: DashboardPermissions;
}

const makeCreatorOption = (user: User) => ({
  value: '_creator',
  label: (
    <UserBadge
      avatarSize={25}
      user={user}
      displayName={<StyledDisplayName>{`You (${user.email})`}</StyledDisplayName>}
      displayEmail="Owner"
    />
  ),
});
const makeTeamOption = (team: Team) => ({
  value: team.id,
  label: `#${team.slug}`,
  leadingItems: <TeamAvatar team={team} size={18} />,
});

function EditAccessSelector({
  dashboardPermissions,
  dashboard,
  onChangeEditAccess,
}: EditAccessSelectorProps) {
  const {teams} = useTeamsById();
  const currentUser = useUser();
  const dashboardOwner = dashboard.createdBy;
  const allTeams = teams.map(team => team.id);

  const [selectedUsers, setselectedUsers] = useState<string[]>(
    dashboardPermissions?.is_creator_only_editable
      ? ['_creator']
      : ['_everyone', '_creator', ...allTeams]
  );

  // if (dashboardPermissions?.is_creator_only_editable) {
  //   setselectedUsers(['_creator']);
  // }

  const options = useMemo(
    () => [
      {value: '_everyone', label: 'Everyone'},
      makeCreatorOption(dashboardOwner ? dashboardOwner : currentUser),
      // {value: '_creator', options: makeCreatorOption(user)},
      {
        value: '_teams',
        label: t('Teams'),
        options: teams.map(makeTeamOption),
        showToggleAllButton: true,
      },
    ],
    [teams, dashboardOwner, currentUser]
  );

  const newdashboardPermissions = {
    is_creator_only_editable: false,
  };

  return (
    <StyledCompactSelect
      size="sm"
      onChange={() => {
        onChangeEditAccess(newdashboardPermissions);
        setselectedUsers(['_everyone']);
        // onChangeEditAccess;
      }}
      multiple
      searchable
      options={options}
      value={selectedUsers}
      triggerLabel={[
        t('Edit Access:'),
        <StyledAvatarList key="avatar-list" users={[currentUser]} avatarSize={25} />,
      ]}
      searchPlaceholder="Search Teams"
      onSearch={() => {
        // console.log(dashboardPermissions);
      }}
    />
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
  margin-left: 12px;
`;
