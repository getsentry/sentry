import isPropValid from '@emotion/is-prop-valid';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout/container';
import type {Responsive} from '@sentry/scraps/layout/styles';

import type {RadiusSize, SurfaceVariant} from 'sentry/utils/theme';

interface BaseSurfaceProps {
  children?: React.ReactNode;
  radius?: Responsive<RadiusSize>;
}
interface FlatSurfaceProps extends BaseSurfaceProps {
  elevation?: never;
  variant?: Exclude<SurfaceVariant, 'overlay'>;
}
interface OverlaySurfaceProps extends BaseSurfaceProps {
  variant: 'overlay';
  elevation?: 'low' | 'high';
}

export type SurfaceProps = FlatSurfaceProps | OverlaySurfaceProps;

const omitSurfaceProps = new Set(['variant', 'elevation', 'radius']);

export const Surface = styled(
  (props: SurfaceProps) => {
    const {variant, elevation: _elevation, radius, ...rest} = props;

    if (variant === 'overlay') {
      return (
        <Container
          background="overlay"
          border="primary"
          radius={radius ?? 'md'}
          {...rest}
        />
      );
    }
    return <Container background={variant} radius={radius} {...rest} />;
  },
  {
    shouldForwardProp: prop => {
      if (omitSurfaceProps.has(prop)) {
        return false;
      }
      return isPropValid(prop);
    },
  }
)`
  box-shadow: ${p => getShadow(p)};
`;

function getShadow({variant, elevation, theme}: SurfaceProps & {theme: Theme}) {
  if (variant === 'overlay') {
    // TODO(design-eng): use shadow tokens
    const shadowLow = `0 ${theme.shadow.sm} 0 0 ${theme.tokens.shadow.elevationLow}`;
    const shadowHigh = `0 ${theme.shadow.sm} 0 0 ${theme.tokens.shadow.elevationLow}, 0 ${theme.shadow.xl} 0 0 ${theme.tokens.shadow.elevationMedium}`;
    const shadow = elevation === 'low' ? shadowLow : shadowHigh;
    return shadow;
  }
  return undefined;
}
