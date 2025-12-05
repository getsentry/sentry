import {useTheme} from '@emotion/react';

import type {ColorOrAlias, IconSize} from 'sentry/utils/theme';

import {useIconDefaults} from './useIconDefaults';

export interface SVGIconProps extends React.SVGAttributes<SVGSVGElement> {
  className?: string;
  color?: ColorOrAlias | 'currentColor';
  /**
   * DO NOT USE THIS! Please use the `size` prop
   *
   * @deprecated
   */
  legacySize?: string;
  ref?: React.Ref<SVGSVGElement>;
  size?: IconSize;
}

export function SvgIcon(props: SVGIconProps) {
  const {
    color: providedColor = 'currentColor',
    size: providedSize = 'sm',
    viewBox = '0 0 16 16',
    legacySize,
    ...rest
  } = useIconDefaults(props);

  const theme = useTheme();
  const color = useResolvedIconColor(providedColor);
  const size = legacySize ?? theme.iconSizes[providedSize];

  return (
    <svg
      // The icons only ever contain a single graphic, so we can use the img role
      role="img"
      viewBox={viewBox}
      {...rest}
      fill={color}
      height={size}
      width={size}
    />
  );
}

export function useResolvedIconColor(
  color: ColorOrAlias | 'currentColor' | undefined
): string {
  const theme = useTheme();
  const {color: providedColor = 'currentColor'} = useIconDefaults({color});
  if (providedColor === 'currentColor') {
    return 'currentColor';
  }

  // Remap gray300 to subText since we no longer support the old theme
  const normalizedColor = providedColor === 'gray300' ? 'subText' : providedColor;
  const resolvedColor = theme[normalizedColor];
  if (typeof resolvedColor === 'string') {
    return resolvedColor;
  }
  return normalizedColor;
}
