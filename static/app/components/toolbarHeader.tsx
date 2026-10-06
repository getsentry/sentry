import {useTheme} from '@emotion/react';

import {Container, type ContainerProps} from '@sentry/scraps/layout';

export function ToolbarHeader({style, ...props}: ContainerProps) {
  const theme = useTheme();

  return (
    <Container
      {...props}
      style={{
        fontSize: '12px',
        textTransform: 'uppercase',
        fontWeight: theme.font.weight.sans.medium,
        color: theme.tokens.content.secondary,
        ...style,
      }}
    />
  );
}
