import {useTheme, type Theme} from '@emotion/react';

import type {ColorOrAlias, IconSize} from 'sentry/utils/theme';

import {useIconDefaults} from './useIconDefaults';

export interface SVGIconProps extends React.SVGAttributes<SVGSVGElement> {
  className?: string;
  /**
   * Please use the `variant` prop instead.
   * @deprecated
   */
  color?: ColorOrAlias | 'currentColor';
  /**
   * DO NOT USE THIS! Please use the `size` prop
   *
   * @deprecated
   */
  legacySize?: string;
  ref?: React.Ref<SVGSVGElement>;
  size?: IconSize;
  variant?: keyof Theme['tokens']['graphics'];
}

export function SvgIcon(props: SVGIconProps) {
  const theme = useTheme();
  const iconProps = useIconDefaults(props);
  const size = iconProps.legacySize ?? theme.iconSizes[iconProps.size ?? 'sm'];

  return (
    <svg
      // The icons only ever contain a single graphic, so we can use the img role
      role="img"
      viewBox="0 0 16 16"
      {...iconProps}
      fill={
        props.variant
          ? theme.tokens.graphics[props.variant]
          : resolveIconColor(theme, iconProps)
      }
      height={size}
      width={size}
    />
  );
}

function resolveIconColor(theme: Theme, providedProps: SVGIconProps): string {
  if (!providedProps.color || providedProps.color === 'currentColor') {
    return 'currentColor';
  }

  // Remap gray300 to subText since we no longer support the old theme
  const normalizedColor =
    providedProps.color === 'gray300' ? 'subText' : providedProps.color;

  const themeValue = theme[normalizedColor];
  return typeof themeValue === 'string' ? themeValue : normalizedColor;
}
