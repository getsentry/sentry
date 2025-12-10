import styled from '@emotion/styled';

import {logout} from 'sentry/actionCreators/account';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import UserBadge from 'sentry/components/idBadge/userBadge';
import {t} from 'sentry/locale';
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

  function handleLogout() {
    logout(api);
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
              <UserBadge user={user} avatarSize={32} />
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
      <UserAvatar size={isMobile ? 20 : 28} user={user} />
    </SidebarMenu>
  );
}

const SectionTitleWrapper = styled('div')`
  text-transform: none;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.tokens.content.primary};
`;
