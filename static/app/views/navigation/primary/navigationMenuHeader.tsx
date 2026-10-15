import type {ReactNode} from 'react';
import {css, ThemeProvider, useTheme} from '@emotion/react';

import {
  getOrganizationAvatarProps,
  getUserAvatarProps,
  OrganizationAvatar,
  UserAvatar,
  type BaseAvatarProps,
} from '@sentry/scraps/avatar';
import {useAvatarColors} from '@sentry/scraps/avatarButton';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t, tn} from 'sentry/locale';
import type {OrganizationSummary} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {useInvertedTheme} from 'sentry/utils/theme/useInvertedTheme';

type NavigationMenuHeaderProps =
  | {organization: OrganizationSummary; projectCount: number; user?: never}
  | {user: User; organization?: never; projectCount?: never};

export function NavigationMenuHeader({
  organization,
  projectCount,
  user,
}: NavigationMenuHeaderProps) {
  if (organization) {
    return (
      <MenuHeader
        label={t('Organization')}
        title={organization.name || organization.slug}
        subtitle={tn('%s Project', '%s Projects', projectCount)}
        avatarProps={getOrganizationAvatarProps(organization)}
        avatar={<OrganizationHeaderAvatar organization={organization} />}
      />
    );
  }

  return (
    <MenuHeader
      label={t('User')}
      title={
        user.name === user.email
          ? user.email.split('@', 1).join('').split('.').join(' ')
          : user.name || user.username || user.email
      }
      subtitle={user.email}
      avatarProps={getUserAvatarProps(user)}
      avatar={
        <Container
          width="32px"
          height="32px"
          radius="full"
          overflow="hidden"
          border="muted"
        >
          <UserAvatar user={user} size={30} />
        </Container>
      }
    />
  );
}

function OrganizationHeaderAvatar({organization}: {organization: OrganizationSummary}) {
  const lightTheme = useInvertedTheme();

  return (
    <Container width="32px" height="32px" radius="md" overflow="hidden" border="muted">
      <ThemeProvider theme={lightTheme}>
        <OrganizationAvatar organization={organization} size={30} />
      </ThemeProvider>
    </Container>
  );
}

function MenuHeader({
  label,
  title,
  subtitle,
  avatar,
  avatarProps,
}: {
  avatar: ReactNode;
  avatarProps: BaseAvatarProps;
  label: string;
  subtitle: string;
  title: string;
}) {
  const currentTheme = useTheme();
  const invertedTheme = useInvertedTheme();
  const avatarColors = useAvatarColors(avatarProps);
  const backgroundColor = avatarColors.type === 'image' ? avatarColors.chonk : undefined;

  return (
    <ThemeProvider theme={currentTheme.type === 'dark' ? currentTheme : invertedTheme}>
      <Container
        radius="sm sm 0 0"
        padding="xs"
        css={theme => css`
          margin: -${theme.space.sm} -${theme.space.lg};
          background: linear-gradient(90deg, #2c155c, #4e168c);
          ${
            backgroundColor &&
            css`
              background: linear-gradient(
                90deg,
                color-mix(in srgb, ${backgroundColor} 25%, black),
                color-mix(in srgb, ${backgroundColor} 40%, black)
              );
            `
          }
        `}
      >
        <Stack gap="md" padding="md lg">
          <Text size="sm" density="fixed" bold variant="primary" tabular>
            {label}
          </Text>
          <Flex align="center" gap="md">
            {avatar}
            <Stack gap="0">
              <Text size="md" density="comfortable" bold variant="primary">
                {title}
              </Text>
              <Text size="sm" density="comfortable" variant="muted" tabular>
                {subtitle}
              </Text>
            </Stack>
          </Flex>
        </Stack>
      </Container>
    </ThemeProvider>
  );
}
