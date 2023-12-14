import {forwardRef} from 'react';
import {useTheme} from '@emotion/react';

import {Aliases, Color, IconSize} from 'sentry/utils/theme';

import {useIconDefaults} from './useIconDefaults';

export interface SVGIconProps extends React.SVGAttributes<SVGSVGElement> {
  className?: string;
  color?: Color | keyof Aliases | 'currentColor';
  /**
   * DO NOT USE THIS! Please use the `size` prop
   *
   * @deprecated
   */
  legacySize?: string;
  size?: IconSize;
}

export const SvgIcon = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  const {
    color: providedColor = 'currentColor',
    size: providedSize = 'sm',
    viewBox = '0 0 16 16',
    legacySize,
    ...rest
  } = useIconDefaults(props);

  const theme = useTheme();
  const color = theme[providedColor] ?? providedColor;
  const size = legacySize ?? theme.iconSizes[providedSize];

  return (
    <svg {...rest} viewBox={viewBox} fill={color} height={size} width={size} ref={ref} />
  );
});
