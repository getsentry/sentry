import {useEffect, useRef} from 'react';
import {css, useTheme} from '@emotion/react';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconSettings} from '@sentry/icons/settings';
import {IconSliders} from '@sentry/icons/sliders';

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
  const settingsV3 = organization?.features.includes('settings-v3') ?? false;

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

  const legacyItems = [
    {
      key: 'user',
      label: (
        <Flex align="center" gap="md">
          <UserAvatar user={user} size={32} />
          <Stack gap="xs">
            <Text size="sm" bold uppercase variant="primary">
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
        {key: 'signout', label: t('Sign Out'), onAction: handleLogout},
      ],
    },
  ];

  const settingsV3Items = [
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
          children: (
            [
              ['system', t('Default to system')],
              ['light', t('Light')],
              ['dark', t('Dark')],
            ] as const
          ).map(([value, label]) => ({
            key: `theme-${value}`,
            label,
            leadingItems:
              user.options.theme === value ? <IconCheckmark size="sm" /> : undefined,
            onAction: () => updateOptions({theme: value}),
          })),
        },
        {
          key: 'time-format',
          label: t('Time Format'),
          children: (
            [
              [false, t('12 hour')],
              [true, t('24 hour')],
            ] as const
          ).map(([value, label]) => ({
            key: `time-format-${value}`,
            label,
            leadingItems:
              user.options.clock24Hours === value ? (
                <IconCheckmark size="sm" />
              ) : undefined,
            onAction: () => updateOptions({clock24Hours: value}),
          })),
        },
      ],
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
      priority: 'danger' as const,
      onAction: handleLogout,
    },
  ];

  return (
    <DropdownMenu
      usePortal
      size={size}
      portalContainerRef={portalContainerRef}
      zIndex={theme.zIndex.modal}
      renderWrapAs={PassthroughWrapper}
      position={layout === 'mobile' ? 'bottom' : 'right-end'}
      minMenuWidth={settingsV3 ? 240 : 200}
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
      menuTitle={
        settingsV3 ? (
          <Stack
            gap="sm"
            css={css`
              margin: -${theme.space.sm} -${theme.space.lg};
              padding: ${theme.space.md} ${theme.space.lg};
              background: linear-gradient(110deg, #2f1757, #55148b);
              color: white;
            `}
          >
            <Text
              bold
              css={css`
                color: inherit;
              `}
            >
              {t('User')}
            </Text>
            <Flex align="center" gap="md">
              <UserAvatar user={user} size={32} />
              <Stack gap="xs">
                <Text
                  bold
                  css={css`
                    color: inherit;
                  `}
                >
                  {user.name || user.username || user.email}
                </Text>
                <Text
                  css={css`
                    color: #cbb5dc;
                  `}
                >
                  {user.email}
                </Text>
              </Stack>
            </Flex>
          </Stack>
        ) : undefined
      }
      items={settingsV3 ? settingsV3Items : legacyItems}
    />
  );
}
