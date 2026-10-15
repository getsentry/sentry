import {useEffect, useRef} from 'react';
import {useTheme} from '@emotion/react';

import {UserAvatar} from '@sentry/scraps/avatar';
import {AvatarButton} from '@sentry/scraps/avatarButton';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Flex, Stack} from '@sentry/scraps/layout';
import {useSizeContext} from '@sentry/scraps/sizeContext';
import {Text} from '@sentry/scraps/text';

import {logout} from 'sentry/actionCreators/account';
import {t} from 'sentry/locale';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useApi} from 'sentry/utils/useApi';
import {useUser} from 'sentry/utils/useUser';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';

// Stable module-level component to avoid remounts when used as `renderWrapAs`
function PassthroughWrapper({children}: {children: React.ReactNode}) {
  return children;
}

export function UserDropdown() {
  const api = useApi();
  const user = useUser();
  const {layout} = usePrimaryNavigation();
  const portalContainerRef = useRef<HTMLElement | null>(null);
  const theme = useTheme();

  useEffect(() => {
    portalContainerRef.current = document.body;
  }, []);

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

  const size = useSizeContext();

  return (
    <DropdownMenu
      usePortal
      size={size}
      portalContainerRef={portalContainerRef}
      zIndex={theme.zIndex.modal}
      renderWrapAs={PassthroughWrapper}
      position={layout === 'mobile' ? 'bottom' : 'right-end'}
      minMenuWidth={200}
      trigger={triggerProps => (
        <AvatarButton
          {...triggerProps}
          aria-label={user.email}
          avatar={avatarProps}
          analyticsEventKey="navigation.primary_item_clicked"
          analyticsEventName="Navigation: Primary Item Clicked"
          analyticsParams={{item: 'account'}}
        />
      )}
      items={[
        {
          key: 'user',
          label: (
            <Flex align="center" gap="md">
              <UserAvatar user={user} size={32} />
              <Stack gap="xs">
                <Text size="sm" bold uppercase variant="primary">
                  {/*
                  Some users never set their name, so lets not show their email twice and
                  attempt to infer their name from their email
                   */}
                  {user.name === user.email
                    ? user.email.split('@')[0]?.split('.').join(' ')
                    : user.name}
                </Text>
                <Text size="xs" variant="muted">
                  {user.email}
                </Text>
              </Stack>
            </Flex>
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
