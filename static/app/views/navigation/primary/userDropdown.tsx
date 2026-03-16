import {useEffect, useRef} from 'react';
import {useTheme} from '@emotion/react';

import {UserAvatar} from '@sentry/scraps/avatar';
import {AvatarButton} from '@sentry/scraps/avatarButton';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {logout} from 'sentry/actionCreators/account';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {PrimaryNavigation} from 'sentry/views/navigation/primary/components';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';

// Stable module-level component to avoid remounts when used as `renderWrapAs`
function PassthroughWrapper({children}: {children: React.ReactNode}) {
  return children;
}

export function UserDropdown() {
  const api = useApi();
  const user = useUser();
  const organization = useOrganization({allowNull: true});
  const {layout} = usePrimaryNavigation();
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
          <Flex justify="start" padding="md 2xl">
            {props => (
              <PrimaryNavigation.Button
                {...props}
                {...triggerProps}
                aria-label={user.email}
                analyticsKey="user-settings"
                label={t('User Settings')}
                buttonProps={{
                  size: 'xs',
                  priority: 'transparent',
                  onClick: e => {
                    handleTriggerClick();
                    triggerProps.onClick?.(e);
                  },
                  icon: <UserAvatar user={user} size={16} />,
                }}
              />
            )}
          </Flex>
        ) : (
          <AvatarButton
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
