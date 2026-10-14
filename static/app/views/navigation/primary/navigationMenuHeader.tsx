import {css} from '@emotion/react';

import {OrganizationAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {useAvatarColors} from '@sentry/scraps/avatarButton';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t, tn} from 'sentry/locale';
import type {OrganizationSummary} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

type NavigationMenuHeaderProps =
  | {organization: OrganizationSummary; projectCount: number; user?: never}
  | {user: User; organization?: never; projectCount?: never};

export function NavigationMenuHeader(props: NavigationMenuHeaderProps) {
  const {organization} = props;
  const avatar = organization?.avatar;
  const avatarIdentity = {
    identifier: organization?.slug ?? '',
    name: organization?.name || organization?.slug || '',
  };
  const avatarColors = useAvatarColors(
    avatar?.avatarType === 'upload' && avatar.avatarUrl
      ? {type: 'upload', uploadUrl: avatar.avatarUrl, ...avatarIdentity}
      : avatar?.avatarType === 'gravatar' && avatar.avatarUrl
        ? {type: 'gravatar', gravatarId: avatar.avatarUrl, ...avatarIdentity}
        : undefined
  );
  const accentColor = avatarColors.type === 'image' ? avatarColors.chonk : undefined;

  const title = organization ? t('Organization') : t('User');
  const name = organization
    ? organization.name || organization.slug
    : props.user.name || props.user.username || props.user.email;
  const subtitle = organization
    ? tn('%s Project', '%s Projects', props.projectCount)
    : props.user.email;

  return (
    <Container
      radius="md md 0 0"
      padding="xs"
      css={theme => css`
        margin: -${theme.space.sm} -${theme.space.lg};
        background: linear-gradient(90deg, #2c155c, #4e168c);
        color: ${darkTheme.tokens.content.headings};
        ${
          accentColor &&
          css`
            background: linear-gradient(
              90deg,
              color-mix(in srgb, ${accentColor} 30%, #2c155c),
              color-mix(in srgb, ${accentColor} 30%, #4e168c)
            );
          `
        }
      `}
    >
      <Stack gap="md" padding="md lg">
        <Text size="sm" density="fixed" bold variant="inherit" tabular>
          {title}
        </Text>
        <Flex align="center" gap="md">
          {organization ? (
            <Flex
              align="center"
              justify="center"
              width="32px"
              height="32px"
              radius="md"
              overflow="hidden"
              css={css`
                background-color: ${lightTheme.tokens.background.primary};
                border: 1px solid ${darkTheme.tokens.border.transparent.neutral.muted};
              `}
            >
              <OrganizationAvatar organization={organization} size={30} />
            </Flex>
          ) : (
            <UserAvatar user={props.user} size={32} />
          )}
          <Stack gap="0">
            <Text size="md" density="comfortable" bold variant="inherit">
              {name}
            </Text>
            <Text
              size="sm"
              density="comfortable"
              variant="inherit"
              tabular
              css={css`
                color: ${darkTheme.tokens.content.secondary};
              `}
            >
              {subtitle}
            </Text>
          </Stack>
        </Flex>
      </Stack>
    </Container>
  );
}
