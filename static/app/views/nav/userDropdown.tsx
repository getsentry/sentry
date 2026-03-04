import styled from '@emotion/styled';

import {AvatarButton} from '@sentry/scraps/avatarButton';

import {logout} from 'sentry/actionCreators/account';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import UserBadge from 'sentry/components/idBadge/userBadge';
import {t} from 'sentry/locale';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useApi from 'sentry/utils/useApi';
import {useUser} from 'sentry/utils/useUser';
import {useNavContext} from 'sentry/views/nav/context';
import {SidebarItem} from 'sentry/views/nav/primary/components';
import {NavLayout} from 'sentry/views/nav/types';

export function UserDropdown() {
  const api = useApi();
  const user = useUser();
  const {layout} = useNavContext();
  const isMobile = layout === NavLayout.MOBILE;

  function handleLogout() {
    logout(api);
  }

  const identifier = user.email || user.username || user.id || user.ip_address;
  const name = user.name || user.email || user.username || '';

  const avatarProps =
    user.avatar?.avatarType === 'upload' && user.avatar.avatarUrl
      ? {type: 'upload' as const, uploadUrl: user.avatar.avatarUrl, identifier, name}
      : user.avatar?.avatarType === 'gravatar' && user.email
        ? {
            type: 'gravatar' as const,
            gravatarId: user.email.toLowerCase(),
            identifier,
            name,
          }
        : {type: 'letter_avatar' as const, identifier, name};

  return (
    <SidebarItem label={user.email} showLabel={isMobile} disableTooltip>
      <DropdownMenu
        position={isMobile ? 'bottom' : 'right-end'}
        minMenuWidth={200}
        trigger={triggerProps => (
          <AvatarButton
            {...triggerProps}
            aria-label={user.email}
            avatar={avatarProps}
            size={isMobile ? 'xs' : 'sm'}
          />
        )}
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
      />
    </SidebarItem>
  );
}

const SectionTitleWrapper = styled('div')`
  text-transform: none;
  font-size: ${p => p.theme.font.size.md};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  color: ${p => p.theme.tokens.content.primary};
`;
