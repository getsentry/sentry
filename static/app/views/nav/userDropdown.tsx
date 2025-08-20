import styled from '@emotion/styled';

import {logout} from 'sentry/actionCreators/account';
import {AvatarEditDrawer} from 'sentry/components/avatarEditDrawer';
import {AvatarWithEditIcon} from 'sentry/components/avatarEditDrawer/avatarWithEditIcon';
import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useApi from 'sentry/utils/useApi';
import {useUser} from 'sentry/utils/useUser';
import {useNavContext} from 'sentry/views/nav/context';
import {SidebarMenu} from 'sentry/views/nav/primary/components';
import {NavLayout} from 'sentry/views/nav/types';

export function UserDropdown() {
  const api = useApi();
  const user = useUser();
  const {layout} = useNavContext();
  const isMobile = layout === NavLayout.MOBILE;
  const {openDrawer} = useDrawer();

  function handleLogout() {
    logout(api);
  }

  function handleAvatarEdit() {
    openDrawer(
      ({closeDrawer}) => (
        <AvatarEditDrawer
          user={user}
          onClose={closeDrawer}
          onSave={(avatarType, avatarData) => {
            // TODO: Implement API call to save avatar changes
            // eslint-disable-next-line no-console
            console.log('Saving avatar:', avatarType, avatarData);
            closeDrawer();
          }}
        />
      ),
      {
        ariaLabel: t('Edit Avatar'),
        drawerWidth: '400px',
      }
    );
  }

  return (
    <SidebarMenu
      label={user.email}
      analyticsKey="account"
      disableTooltip
      items={[
        {
          key: 'user',
          label: (
            <SectionTitleWrapper>
              <AvatarWithEditIcon user={user} size={32} onEditClick={handleAvatarEdit} />
              <UserInfo>
                <UserName>{user.name || user.email || user.username}</UserName>
                <UserEmail>{user.email}</UserEmail>
              </UserInfo>
            </SectionTitleWrapper>
          ),
          textValue: t('User Summary'),
          children: [
            {
              key: 'user-settings',
              label: t('User Settings'),
              to: '/settings/account/',
            },
            {
              key: 'admin',
              label: t('Admin'),
              to: '/manage/',
              hidden: !isActiveSuperuser(),
            },
            {
              key: 'signout',
              label: t('Sign Out'),
              onAction: handleLogout,
            },
          ],
        },
      ]}
    >
      <AvatarWithEditIcon
        size={isMobile ? 20 : 28}
        user={user}
        onEditClick={handleAvatarEdit}
      />
    </SidebarMenu>
  );
}

const SectionTitleWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  text-transform: none;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.textColor};
`;

const UserInfo = styled('div')`
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const UserName = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.md};
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const UserEmail = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;
