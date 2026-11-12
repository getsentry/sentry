import type {ReactNode} from 'react';
import {css, ThemeProvider, useTheme} from '@emotion/react';

import {OrganizationAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {useInvertedTheme} from '@sentry/scraps/theme';

import {t, tn} from 'sentry/locale';
import type {OrganizationSummary} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';

import {useOrganizationPalette} from './useOrganizationPalette';

// Both headers take their gradient from the current organization's avatar, so
// the menus match. Without an organization they use the default gradient.
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
      avatar={
        <Flex
          position="relative"
          width="32px"
          height="32px"
          radius="full"
          overflow="hidden"
          border="muted"
        >
          <UserAvatar user={user} size={30} />
        </Flex>
      }
    />
  );
}

function OrganizationHeaderAvatar({organization}: {organization: OrganizationSummary}) {
  const lightTheme = useInvertedTheme();

  return (
    <Flex
      position="relative"
      width="32px"
      height="32px"
      radius="md"
      overflow="hidden"
      border="muted"
    >
      <ThemeProvider theme={lightTheme}>
        <OrganizationAvatar organization={organization} size={30} />
      </ThemeProvider>
    </Flex>
  );
}

function MenuHeader({
  label,
  title,
  subtitle,
  avatar,
}: {
  avatar: ReactNode;
  label: string;
  subtitle: string;
  title: string;
}) {
  const currentTheme = useTheme();
  const invertedTheme = useInvertedTheme();
  const {gradient} = useOrganizationPalette();

  return (
    <ThemeProvider theme={currentTheme.type === 'dark' ? currentTheme : invertedTheme}>
      <Container
        radius="sm sm 0 0"
        padding="xs"
        css={theme => css`
          margin: -${theme.space.sm} -${theme.space.lg};
          background: linear-gradient(90deg, ${gradient.start}, ${gradient.end});
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
