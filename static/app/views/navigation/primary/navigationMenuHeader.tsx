import {css} from '@emotion/react';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {darkTheme} from 'sentry/utils/theme/theme';

interface NavigationMenuHeaderProps {
  avatar: React.ReactNode;
  name: string;
  subtitle: string;
  title: string;
  accentColor?: string;
}

export function NavigationMenuHeader({
  accentColor,
  avatar,
  name,
  subtitle,
  title,
}: NavigationMenuHeaderProps) {
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
          {avatar}
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
