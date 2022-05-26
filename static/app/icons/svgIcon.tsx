import {forwardRef} from 'react';
import {useTheme} from '@emotion/react';

import {Aliases, Color, IconSize} from 'sentry/utils/theme';

export interface SVGIconProps extends React.SVGAttributes<SVGSVGElement> {
  className?: string;
  color?: Color | keyof Aliases;
  // TODO (Priscila): make size prop theme icon size only
  size?: IconSize | string;
}

const SvgIcon = forwardRef<SVGSVGElement, SVGIconProps>(function SvgIcon(
  {
    color: providedColor = 'currentColor',
    size: providedSize = 'sm',
    viewBox = '0 0 16 16',
    ...props
  },
  ref
) {
  const theme = useTheme();
  const color = theme[providedColor] ?? providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;

  return (
    <svg {...props} viewBox={viewBox} fill={color} height={size} width={size} ref={ref} />
  );
});

export default SvgIcon;
