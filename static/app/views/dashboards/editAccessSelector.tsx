import {useMemo} from 'react';
import styled from '@emotion/styled';

import AvatarList from 'sentry/components/avatar/avatarList';
import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import {CompactSelect} from 'sentry/components/compactSelect';
import UserBadge from 'sentry/components/idBadge/userBadge';
import {t} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import {useUser} from 'sentry/utils/useUser';

const makeCreatorOption = (user: User) => [
  {
    value: 'creator',
    label: (
      <UserBadge
        avatarSize={25}
        user={user}
        displayName={<StyledDisplayName>{`You (${user.email})`}</StyledDisplayName>}
        displayEmail="Owner"
      />
    ),
  },
];

const makeTeamOption = (team: Team) => ({
  value: team.id,
  label: `#${team.slug}`,
  leadingItems: <TeamAvatar team={team} size={18} />,
});

function EditAccessSelector({selectedUsers = ['creator']}) {
  const {teams} = useTeamsById();
  const user = useUser();

  const options = useMemo(
    () => [
      {value: '_creator', options: makeCreatorOption(user)},
      {value: '_teams', label: t('Teams'), options: teams.map(makeTeamOption)},
    ],
    [teams, user]
  );

  return (
    <CompactSelect
      size="sm"
      multiple
      searchable
      options={options}
      value={selectedUsers}
      triggerLabel={[
        t('Edit Access:'),
        <StyledAvatarList key="avatar-list">
          <AvatarList key="avatar-list" users={[user, user, user]} avatarSize={25} />
        </StyledAvatarList>,
      ]}
      searchPlaceholder="Search Teams"
    />
  );
}

export default EditAccessSelector;

const StyledDisplayName = styled('div')`
  font-weight: normal;
`;

const StyledAvatarList = styled('div')`
  margin-left: 8px;
`;
