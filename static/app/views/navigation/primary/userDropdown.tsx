import {useEffect, useRef} from 'react';
import {useTheme} from '@emotion/react';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconSettings} from '@sentry/icons/settings';
import {IconSliders} from '@sentry/icons/sliders';
import {IconUpload} from '@sentry/icons/upload';

import {UserAvatar} from '@sentry/scraps/avatar';
import {AvatarButton} from '@sentry/scraps/avatarButton';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Flex, Stack} from '@sentry/scraps/layout';
import {useSizeContext} from '@sentry/scraps/sizeContext';
import {Text} from '@sentry/scraps/text';

import {logout} from 'sentry/actionCreators/account';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useApi} from 'sentry/utils/useApi';
import {useMutateUserOptions} from 'sentry/utils/useMutateUserOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

import {getUserMenuDisplayName} from './getUserMenuDisplayName';
import {NavigationMenuHeader} from './navigationMenuHeader';

// Stable module-level component to avoid remounts when used as `renderWrapAs`
function PassthroughWrapper({children}: {children: React.ReactNode}) {
  return children;
}

export function UserDropdown() {
  const api = useApi();
  const user = useUser();
  const organization = useOrganization({allowNull: true});
  const {layout} = usePrimaryNavigation();
  const portalContainerRef = useRef<HTMLElement | null>(null);
  const theme = useTheme();
  const {mutate: updateOptions} = useMutateUserOptions();
  const settingsV3 = useSettingsV3();

  useEffect(() => {
    portalContainerRef.current = document.body;
  }, []);

  function handleLogout() {
    logout(api);
  }

  function handleTriggerClick() {
    trackAnalytics('navigation.primary_item_clicked', {
      item: 'account',
      organization,
    });
  }

  const identifier = user.email || user.username || user.id || user.ip_address;
  const name = user.name || user.email || user.username || '';

  const avatarProps =
    user.avatar?.avatarType === 'upload' && user.avatar.avatarUrl
      ? {
          type: 'upload' as const,
          uploadUrl: user.avatar.avatarUrl,
          identifier,
          name,
        }
      : user.avatar?.avatarType === 'gravatar' && user.email
        ? {
            type: 'gravatar' as const,
            gravatarId: user.email.toLowerCase(),
            identifier,
            name,
          }
        : {type: 'letter_avatar' as const, identifier, name};

  const size = useSizeContext();

  if (settingsV3) {
    return (
      <DropdownMenu
        usePortal
        size={size}
        portalContainerRef={portalContainerRef}
        zIndex={theme.zIndex.modal}
        renderWrapAs={PassthroughWrapper}
        position={layout === 'mobile' ? 'bottom' : 'right-end'}
        minMenuWidth={224}
        trigger={triggerProps => (
          <AvatarButton
            {...triggerProps}
            aria-label={user.email}
            avatar={avatarProps}
            onClick={e => {
              handleTriggerClick();
              triggerProps.onClick?.(e);
            }}
          />
        )}
        menuTitle={<NavigationMenuHeader user={user} />}
        items={[
          {
            key: 'account-actions',
            children: [
              {
                key: 'settings',
                label: t('Settings'),
                leadingItems: <IconSettings size="sm" />,
                to: '/settings/account/',
              },
              {
                key: 'preferences',
                label: t('Preferences'),
                leadingItems: <IconSliders size="sm" />,
                submenu: {title: t('Preferences')},
                children: [
                  {
                    key: 'theme',
                    label: t('Theme'),
                    children: [
                      {
                        key: 'theme-system',
                        label: t('Default to system'),
                        leadingItems:
                          user.options.theme === 'system' ? (
                            <IconCheckmark size="sm" />
                          ) : undefined,
                        onAction: () => updateOptions({theme: 'system'}),
                      },
                      {
                        key: 'theme-light',
                        label: t('Light'),
                        leadingItems:
                          user.options.theme === 'light' ? (
                            <IconCheckmark size="sm" />
                          ) : undefined,
                        onAction: () => updateOptions({theme: 'light'}),
                      },
                      {
                        key: 'theme-dark',
                        label: t('Dark'),
                        leadingItems:
                          user.options.theme === 'dark' ? (
                            <IconCheckmark size="sm" />
                          ) : undefined,
                        onAction: () => updateOptions({theme: 'dark'}),
                      },
                    ],
                  },
                  {
                    key: 'time-format',
                    label: t('Time Format'),
                    children: [
                      {
                        key: 'time-format-false',
                        label: t('12 hour'),
                        leadingItems: user.options.clock24Hours ? undefined : (
                          <IconCheckmark size="sm" />
                        ),
                        onAction: () => updateOptions({clock24Hours: false}),
                      },
                      {
                        key: 'time-format-true',
                        label: t('24 hour'),
                        leadingItems: user.options.clock24Hours ? (
                          <IconCheckmark size="sm" />
                        ) : undefined,
                        onAction: () => updateOptions({clock24Hours: true}),
                      },
                    ],
                  },
                ],
              },
              {
                key: 'admin',
                label: t('Admin'),
                to: '/manage/',
                hidden: !isActiveSuperuser(),
              },
            ],
          },
          {
            key: 'signout',
            label: t('Sign Out'),
            leadingItems: <IconUpload direction="left" />,
            priority: 'danger' as const,
            onAction: handleLogout,
          },
        ]}
      />
    );
  }

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
          onClick={e => {
            handleTriggerClick();
            triggerProps.onClick?.(e);
          }}
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
                  {getUserMenuDisplayName(user)}
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
            {key: 'signout', label: t('Sign Out'), onAction: handleLogout},
          ],
        },
      ]}
    />
  );
}
