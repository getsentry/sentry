import {css, useTheme} from '@emotion/react';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

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
  const theme = useTheme();
  const gradient = accentColor
    ? `linear-gradient(90deg, color-mix(in srgb, ${accentColor} 30%, #2c155c), color-mix(in srgb, ${accentColor} 30%, #4e168c))`
    : 'linear-gradient(90deg, #2c155c, #4e168c)';

  return (
    <Stack
      gap="0"
      padding="xs"
      css={css`
        margin: -${theme.space.sm} -${theme.space.lg};
        background: linear-gradient(90deg, #2c155c, #4e168c);
        background: ${gradient};
        border-radius: ${theme.radius.md} ${theme.radius.md} 0 0;
        color: white;
      `}
    >
      <Flex align="center" height="32px" padding="0 lg">
        <Text size="sm" bold variant="inherit">
          {title}
        </Text>
      </Flex>
      <Flex align="center" gap="md" padding="0 lg md">
        {avatar}
        <Stack gap="0">
          <Text size="md" bold variant="inherit">
            {name}
          </Text>
          <Text size="sm" variant="inherit">
            {subtitle}
          </Text>
        </Stack>
      </Flex>
    </Stack>
  );
}
