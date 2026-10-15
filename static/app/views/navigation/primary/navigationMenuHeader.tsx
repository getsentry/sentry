import type {ReactNode} from 'react';
import {css, ThemeProvider, useTheme} from '@emotion/react';

import {OrganizationAvatar, UserAvatar} from '@sentry/scraps/avatar';
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
      <OrganizationMenuHeader organization={organization} projectCount={projectCount} />
    );
  }

  return (
    <MenuHeader
      title={t('User')}
      name={user.name || user.username || user.email}
      subtitle={user.email}
      avatar={<UserAvatar user={user} size={32} />}
    />
  );
}

function OrganizationMenuHeader({
  organization,
  projectCount,
}: {
  organization: OrganizationSummary;
  projectCount: number;
}) {
  const avatar = organization.avatar;
  const avatarIdentity = {
    identifier: organization.slug,
    name: organization.name || organization.slug,
  };
  const avatarColors = useAvatarColors(
    avatar?.avatarType === 'upload' && avatar.avatarUrl
      ? {type: 'upload', uploadUrl: avatar.avatarUrl, ...avatarIdentity}
      : avatar?.avatarType === 'gravatar' && avatar.avatarUrl
        ? {type: 'gravatar', gravatarId: avatar.avatarUrl, ...avatarIdentity}
        : undefined
  );
  return (
    <MenuHeader
      title={t('Organization')}
      name={organization.name || organization.slug}
      subtitle={tn('%s Project', '%s Projects', projectCount)}
      backgroundColor={avatarColors.type === 'image' ? avatarColors.chonk : undefined}
      avatar={<OrganizationHeaderAvatar organization={organization} />}
    />
  );
}

function OrganizationHeaderAvatar({organization}: {organization: OrganizationSummary}) {
  const lightTheme = useInvertedTheme();

  return (
    <ThemeProvider theme={lightTheme}>
      <Flex
        align="center"
        justify="center"
        width="32px"
        height="32px"
        radius="md"
        overflow="hidden"
        background="primary"
        border="muted"
      >
        <OrganizationAvatar organization={organization} size={30} />
      </Flex>
    </ThemeProvider>
  );
}

function MenuHeader({
  title,
  name,
  subtitle,
  avatar,
  backgroundColor,
}: {
  avatar: ReactNode;
  name: string;
  subtitle: string;
  title: string;
  backgroundColor?: string;
}) {
  const currentTheme = useTheme();
  const invertedTheme = useInvertedTheme();

  return (
    <ThemeProvider theme={currentTheme.type === 'dark' ? currentTheme : invertedTheme}>
      <Container
        radius="md md 0 0"
        padding="xs"
        css={theme => css`
          margin: -${theme.space.sm} -${theme.space.lg};
          background: linear-gradient(90deg, #2c155c, #4e168c);
          ${
            backgroundColor &&
            css`
              background: linear-gradient(
                90deg,
                color-mix(in srgb, ${backgroundColor} 30%, #2c155c),
                color-mix(in srgb, ${backgroundColor} 30%, #4e168c)
              );
            `
          }
        `}
      >
        <Stack gap="md" padding="md lg">
          <Text size="sm" density="fixed" bold variant="primary" tabular>
            {title}
          </Text>
          <Flex align="center" gap="md">
            {avatar}
            <Stack gap="0">
              <Text size="md" density="comfortable" bold variant="primary">
                {name}
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
