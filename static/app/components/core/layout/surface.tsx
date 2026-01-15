import type {ComponentProps} from 'react';
import {useTheme} from '@emotion/react';

import {Container} from '@sentry/scraps/layout/container';

import type {SurfaceVariant} from 'sentry/utils/theme';

interface BaseSurfaceProps {
  children?: React.ReactNode;
}
interface FlatSurfaceProps extends BaseSurfaceProps {
  elevation?: never;
  variant?: Exclude<SurfaceVariant, 'overlay'>;
}
interface OverlaySurfaceProps extends BaseSurfaceProps {
  variant: 'overlay';
  elevation?: 'low' | 'high';
}
interface WellSurfaceProps extends BaseSurfaceProps {
  variant: 'well';
  elevation?: never;
}

type SurfaceProps = FlatSurfaceProps | OverlaySurfaceProps | WellSurfaceProps;

export function Surface(props: SurfaceProps) {
  const {variant, elevation} = props;
  const baseProps = {as: 'div', padding: 'md'} as Omit<
    ComponentProps<typeof Container<'div'>>,
    'children'
  >;
  const theme = useTheme();
  if (variant === 'overlay') {
    const shadowLow = `0 ${theme.shadow.sm} 0 0 ${theme.tokens.shadow.elevationLow}`;
    const shadowHigh = `0 ${theme.shadow.sm} 0 0 ${theme.tokens.shadow.elevationLow}, 0 ${theme.shadow.xl} 0 0 ${theme.tokens.shadow.elevationMedium}`;
    const shadow = elevation === 'low' ? {boxShadow: shadowLow} : {boxShadow: shadowHigh};
    return (
      <Container
        {...baseProps}
        background="overlay"
        border="primary"
        radius="md"
        style={{...shadow}}
        {...props}
      />
    );
  }
  if (variant === 'well') {
    const background = theme.tokens.interactive.chonky.debossed.neutral.background;
    const boxShadow = `inset 0 ${theme.shadow.md} 0 0 ${theme.tokens.interactive.chonky.debossed.neutral.chonk}`;
    return (
      <Container
        {...baseProps}
        border="primary"
        style={{background, boxShadow}}
        radius="md"
        {...props}
      />
    );
  }
  return <Container {...baseProps} background={variant} {...props} />;
}
