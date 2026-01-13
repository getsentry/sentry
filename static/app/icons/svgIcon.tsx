import {useTheme} from '@emotion/react';

import type {ContentVariant, IconSize} from 'sentry/utils/theme';

import {useIconDefaults} from './useIconDefaults';

export interface SVGIconProps extends Omit<React.SVGAttributes<SVGSVGElement>, 'color'> {
  /**
   * DO NOT USE THIS! Please use the `size` prop
   *
   * @deprecated
   */
  legacySize?: string;
  ref?: React.Ref<SVGSVGElement>;
  size?: IconSize;
  variant?: ContentVariant;
}

export function SvgIcon(props: SVGIconProps) {
  const theme = useTheme();
  const iconProps = useIconDefaults(props);
  const size = iconProps.legacySize ?? ICON_SIZES[iconProps.size ?? 'sm'];

  const {variant: _variant, size: _size, legacySize: _legacySize, ...rest} = iconProps;

  return (
    <svg
      // The icons only ever contain a single graphic, so we can use the img role
      role="img"
      viewBox="0 0 16 16"
      {...rest}
      fill={
        // Exception for warning icon variant. Design enginering needs to figure out what
        // to align this color to, as content.warning looks too dark in this context.
        iconProps.variant === 'warning'
          ? theme.tokens.graphics.warning.vibrant
          : iconProps.variant
            ? theme.tokens.content[iconProps.variant]
            : 'currentColor'
      }
      height={size}
      width={size}
    />
  );
}

export type SVGIconDirection = 'up' | 'right' | 'down' | 'left';
const ICON_DIRECTION_TO_ROTATION_ANGLE = {
  up: 0,
  right: 90,
  down: 180,
  left: 270,
} as const;

SvgIcon.ICON_DIRECTION_TO_ROTATION_ANGLE = ICON_DIRECTION_TO_ROTATION_ANGLE;

/**
 * @TODO(jonasbadalic): There are other icons that either already use or should use this size map.
 * Our icon implementation is specialized for SVGs, but this is not always the case for other icons that
 * might be img or div elements, and we should instead provide a container implementation that implements
 * a common icon size interface and handles the resolution. With some small changes to the types, this
 * could be achieved via a small wrapper around the Container component.
 */
const ICON_SIZES: Record<IconSize, string> = {
  xs: '12px',
  sm: '14px',
  md: '18px',
  lg: '24px',
  xl: '32px',
  '2xl': '72px',
} as const;

SvgIcon.ICON_SIZES = ICON_SIZES;
