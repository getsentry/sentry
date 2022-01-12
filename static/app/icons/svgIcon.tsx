import * as React from 'react';
import {useTheme} from '@emotion/react';

import {Aliases, Color, IconSize} from 'sentry/utils/theme';

const SVGIconCircle = () => {
  return (
    <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
  );
};

export interface SVGIconProps extends React.SVGAttributes<SVGSVGElement> {
  color?: Color | keyof Aliases;
  // TODO (Priscila): make size prop theme icon size only
  size?: IconSize | string;
  className?: string;
  isCircled?: boolean;
}

const SvgIcon = React.forwardRef<SVGSVGElement, SVGIconProps>(function SvgIcon(
  {
    color: providedColor = 'currentColor',
    size: providedSize = 'sm',
    viewBox = '0 0 16 16',
    isCircled,
    children,
    ...props
  },
  ref
) {
  const theme = useTheme();
  const color = theme[providedColor] ?? providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;

  return (
    <svg {...props} viewBox={viewBox} fill={color} height={size} width={size} ref={ref}>
      {/* Not all icons are visually compatible with circle */}
      {isCircled ? <SVGIconCircle /> : null}
      {children}
    </svg>
  );
});

export default SvgIcon;
