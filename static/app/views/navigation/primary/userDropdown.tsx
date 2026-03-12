import {useEffect, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {UserAvatar} from '@sentry/scraps/avatar';
import {AvatarButton} from '@sentry/scraps/avatarButton';
import {Button} from '@sentry/scraps/button';

import {logout} from 'sentry/actionCreators/account';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import UserBadge from 'sentry/components/idBadge/userBadge';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useNavigationContext} from 'sentry/views/navigation/navigationContext';

// Stable module-level component to avoid remounts when used as `renderWrapAs`
function PassthroughWrapper({children}: {children: React.ReactNode}) {
  return children;
}

export function UserDropdown() {
  const api = useApi();
  const user = useUser();
  const organization = useOrganization({allowNull: true});
  const {layout} = useNavigationContext();
  const isMobile = layout === 'mobile';
  const portalContainerRef = useRef<HTMLElement | null>(null);
  const theme = useTheme();

  useEffect(() => {
    portalContainerRef.current = document.body;
  }, []);

  function handleLogout() {
    logout(api);
  }

  function handleTriggerClick() {
    trackAnalytics('navigation.primary_item_clicked', {item: 'account', organization});
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
    <DropdownMenu
      usePortal
      portalContainerRef={portalContainerRef}
      zIndex={theme.zIndex.modal}
      renderWrapAs={PassthroughWrapper}
      position={isMobile ? 'bottom' : 'right-end'}
      minMenuWidth={200}
      trigger={triggerProps =>
        isMobile ? (
          <MobileUserButton
            {...triggerProps}
            aria-label={user.email}
            icon={<UserAvatar user={user} size={16} />}
            priority="transparent"
            size="xs"
            onClick={e => {
              handleTriggerClick();
              triggerProps.onClick?.(e);
            }}
          >
            {t('User Settings')}
          </MobileUserButton>
        ) : (
          <FullWidthAvatarButton
            {...triggerProps}
            aria-label={user.email}
            avatar={avatarProps}
            size="sm"
            onClick={e => {
              handleTriggerClick();
              triggerProps.onClick?.(e);
            }}
          />
        )
      }
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
  );
}

const FullWidthAvatarButton = styled(AvatarButton)`
  min-width: unset;
`;

const MobileUserButton = styled(Button)`
  width: 100%;
  justify-content: flex-start;
  padding: ${p => p.theme.space.md} ${p => p.theme.space['2xl']};
`;

const SectionTitleWrapper = styled('div')`
  text-transform: none;
  font-size: ${p => p.theme.font.size.md};
  font-weight: ${p => p.theme.font.weight.sans.regular};
  color: ${p => p.theme.tokens.content.primary};
`;
