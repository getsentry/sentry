import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {
  Container,
  type ContainerElement,
  type ContainerProps,
} from '@sentry/scraps/layout/container';

import type {SurfaceVariant} from 'sentry/utils/theme';

interface FlatSurfaceProps<T extends ContainerElement = 'div'>
  extends Omit<ContainerProps<T>, 'background' | 'border'> {
  elevation?: never;
  variant?: SurfaceVariant;
}

interface OverlaySurfaceProps<T extends ContainerElement = 'div'>
  extends Omit<ContainerProps<T>, 'background' | 'border'> {
  variant: 'overlay';
  elevation?: 'low' | 'high';
}

type SurfaceProps<T extends ContainerElement = 'div'> =
  | FlatSurfaceProps<T>
  | OverlaySurfaceProps<T>;

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
 */
export const Surface = styled((props: SurfaceProps<any>) => {
  const {variant, elevation: _, ...rest} = props;
  if (variant === 'overlay') {
    return <Container border="primary" radius={props.radius ?? 'md'} {...rest} />;
  }
  return <Container radius={props.radius} {...props} />;
})<SurfaceProps<any>>`
  background: ${p => (p.variant ? p.theme.tokens.background[p.variant] : undefined)};
  box-shadow: ${p => getShadow(p, p.theme)};
` as unknown as <T extends ContainerElement = 'div'>(
  props: SurfaceProps<T>
) => React.ReactElement;

function getShadow(props: SurfaceProps<any>, theme: Theme) {
  if (props.variant === 'overlay') {
    // TODO(design-eng): use shadow tokens
    switch (props.elevation) {
      case 'high':
        return `0 ${theme.shadow.sm} 0 0 ${theme.tokens.shadow.elevationMedium}, 0 ${theme.shadow.xl} 0 0 ${theme.tokens.shadow.elevationMedium}`;
      default:
      case 'low':
        return `0 ${theme.shadow.sm} 0 0 ${theme.tokens.shadow.elevationLow}`;
    }
  }
  return undefined;
}
