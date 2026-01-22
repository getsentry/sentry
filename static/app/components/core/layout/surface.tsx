import isPropValid from '@emotion/is-prop-valid';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout/container';
import type {Responsive} from '@sentry/scraps/layout/styles';

import type {RadiusSize, SurfaceVariant} from 'sentry/utils/theme';

interface BaseSurfaceProps {
  children?: React.ReactNode;
  radius?: Responsive<RadiusSize>;
  ref?: React.Ref<HTMLDivElement>;
}
interface FlatSurfaceProps extends BaseSurfaceProps {
  elevation?: never;
  variant?: Exclude<SurfaceVariant, 'overlay'>;
}
interface OverlaySurfaceProps extends BaseSurfaceProps {
  variant: 'overlay';
  elevation?: 'low' | 'high';
}

type SurfaceProps = FlatSurfaceProps | OverlaySurfaceProps;

const omitSurfaceProps = new Set(['variant', 'elevation']);

const StyledSurface = styled(Container, {
  shouldForwardProp: prop => {
    if (omitSurfaceProps.has(prop)) {
      return false;
    }
    return isPropValid(prop);
  },
})<SurfaceProps>`
  box-shadow: ${p => getShadow(p)};
`;

/**
 * Surface is a layout primitive that provides background colors and optional elevation
 * shadows for layered UI elements. It extends Container with variant-specific styling.
 *
 * @param variant - Surface background variant:
 *   - `primary` | `secondary` | `tertiary`: Flat surfaces with no elevation
 *   - `overlay`: Elevated surface with shadow (e.g., modals, popovers, dropdowns)
 *
 * @param elevation - Shadow depth for overlay variant only. Defaults to `low` for overlays.
 *   - `low`: Subtle shadow for slightly elevated content (default)
 *   - `high`: Prominent shadow for modals and dialogs
 *
 * @param radius - Border radius size. Defaults to `md` for overlay variant, no default for others.
 *
 * @example
 * // Flat surface
 * <Surface variant="primary">Content</Surface>
 *
 * // Elevated overlay with default (low) elevation
 * <Surface variant="overlay">Dropdown content</Surface>
 *
 * // Elevated overlay with high elevation
 * <Surface variant="overlay" elevation="high">Modal content</Surface>
 *
 * // With responsive radius
 * <Surface variant="secondary" radius={{xs: 'sm', md: 'lg'}}>Content</Surface>
 */
export function Surface(props: SurfaceProps) {
  const {variant, elevation, radius, ...rest} = props;

  if (variant === 'overlay') {
    return (
      <StyledSurface
        variant={variant}
        elevation={elevation}
        display="block"
        background="overlay"
        border="primary"
        radius={radius ?? 'md'}
        {...rest}
      />
    );
  }

  return (
    <StyledSurface
      variant={variant}
      display="block"
      background={variant}
      radius={radius}
      {...rest}
    />
  );
}

function getShadow({variant, elevation, theme}: SurfaceProps & {theme: Theme}) {
  if (variant === 'overlay') {
    // TODO(design-eng): use shadow tokens
    switch (elevation) {
      case 'high':
        return `0 ${theme.shadow.sm} 0 0 ${theme.tokens.shadow.elevationMedium}, 0 ${theme.shadow.xl} 0 0 ${theme.tokens.shadow.elevationMedium}`;
      default:
      case 'low':
        return `0 ${theme.shadow.sm} 0 0 ${theme.tokens.shadow.elevationLow}`;
    }
  }
  return undefined;
}
