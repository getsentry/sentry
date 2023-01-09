import {forwardRef} from 'react';
import {useTheme} from '@emotion/react';

import {Aliases, Color, IconSize} from 'sentry/utils/theme';

export interface SVGIconProps extends React.SVGAttributes<SVGSVGElement> {
  className?: string;
  color?: Color | keyof Aliases;
  /**
   * DO NOT USE THIS! Please use the `size` prop
   *
   * @deprecated
   */
  legacySize?: string;
  size?: IconSize;
}

export const SvgIcon = forwardRef<SVGSVGElement, SVGIconProps>(function SvgIcon(
  {
    color: providedColor = 'currentColor',
    size: providedSize = 'sm',
    legacySize,
    viewBox = '0 0 16 16',
    ...props
  },
  ref
) {
  const theme = useTheme();
  const color = theme[providedColor] ?? providedColor;
  const size = legacySize ?? theme.iconSizes[providedSize];

  return (
    <svg {...props} viewBox={viewBox} fill={color} height={size} width={size} ref={ref} />
  );
});
