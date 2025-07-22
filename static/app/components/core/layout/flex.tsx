import type {CSSProperties} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import type {DO_NOT_USE_ChonkTheme, Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {isChonkTheme} from 'sentry/utils/theme/withChonk';

// We alias None -> 0 to make it slighly more terse and easier to read.
type RadiusSize = keyof DO_NOT_USE_ChonkTheme['radius'] | '0';
type SpacingSize = keyof Theme['space'] | '0';

// @TODO(jonasbadalic): audit for memory usage and linting performance issues.
// These may not be trivial to infer as we are dealing with n^4 complexity
type Spacing =
  | `${SpacingSize} ${SpacingSize} ${SpacingSize} ${SpacingSize}`
  | `${SpacingSize} ${SpacingSize} ${SpacingSize}`
  | `${SpacingSize} ${SpacingSize}`
  | `${SpacingSize}`;

type Radius =
  | `${RadiusSize} ${RadiusSize} ${RadiusSize} ${RadiusSize}`
  | `${RadiusSize} ${RadiusSize} ${RadiusSize}`
  | `${RadiusSize} ${RadiusSize}`
  | `${RadiusSize}`;

interface ContainerProps {
  as?:
    | 'div'
    | 'span'
    | 'section'
    | 'article'
    | 'header'
    | 'footer'
    | 'main'
    | 'nav'
    | 'ul'
    | 'ol'
    | 'li';
  background?: keyof Theme['tokens']['background'];
  children?: React.ReactNode;
  display?:
    | 'block'
    | 'inline'
    | 'inline-block'
    | 'flex'
    | 'inline-flex'
    | 'grid'
    | 'inline-grid'
    | 'none';
  margin?: Spacing;
  padding?: Spacing;
  radius?: Radius;
}

export const Container = styled(
  ({children, ...props}: ContainerProps) => {
    const Component = props.as ?? 'div';
    return <Component {...props}>{children}</Component>;
  },
  {
    shouldForwardProp: prop => isPropValid(prop),
  }
)<ContainerProps>`
  display: ${p => p.display};
  background: ${p =>
    p.background ? p.theme.tokens.background[p.background] : undefined};
  border-radius: ${p => getRadius(p.radius, p.theme)};
  margin: ${p => getSpacing(p.margin, p.theme)};
  padding: ${p => getSpacing(p.padding, p.theme)};
`;

interface FlexProps extends Omit<ContainerProps, 'display'> {
  align?: CSSProperties['alignItems'];
  direction?: CSSProperties['flexDirection'];
  flex?: CSSProperties['flex'];
  gap?: CSSProperties['gap'];
  /**
   * Determines whether the flex container should be displayed as an inline-flex.
   */
  inline?: boolean;
  justify?: CSSProperties['justifyContent'];
  wrap?: CSSProperties['flexWrap'];
}

export const Flex = styled('div', {
  shouldForwardProp: prop => isPropValid(prop),
})<FlexProps>`
  display: ${p => (p.inline ? 'inline-flex' : 'flex')};
  flex-direction: ${p => p.direction};
  justify-content: ${p => p.justify};
  align-items: ${p => p.align};
  gap: ${p => p.gap};
  flex-wrap: ${p => p.wrap};
  flex: ${p => p.flex};
`;

function resolveRadius(sizeComponent: Radius | undefined, theme: Theme) {
  if (sizeComponent === undefined) {
    return undefined;
  }
  if (sizeComponent === '0') {
    return '0px';
  }
  return isChonkTheme(theme)
    ? theme.radius[sizeComponent as keyof typeof theme.radius]
    : theme.borderRadius;
}

function resolveSpacing(sizeComponent: SpacingSize, theme: Theme) {
  if (sizeComponent === undefined) {
    return undefined;
  }
  if (sizeComponent === '0') {
    return theme.space.none;
  }

  return theme.space[sizeComponent] ?? theme.space.none;
}

function getRadius(radius: Radius | undefined, theme: Theme) {
  if (!radius) {
    return undefined;
  }

  return radius
    .split(' ')
    .map(size => resolveRadius(size as RadiusSize, theme))
    .join(' ');
}

// @TODO(jonasbadalic): check if we should cache this
function getSpacing(spacing: Spacing | undefined, theme: Theme): string | undefined {
  if (!spacing) {
    return undefined;
  }
  return spacing
    .split(' ')
    .map(size => resolveSpacing(size as SpacingSize, theme))
    .join(' ');
}
