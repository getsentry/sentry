import React from 'react';

import theme, {Aliases, Color, IconSize} from 'app/utils/theme';

type Props = React.SVGAttributes<SVGElement> & {
  color?: Color | keyof Aliases;
  // TODO (Priscila): make size prop theme icon size only
  size?: IconSize | string;
  className?: string;
};

const SvgIcon = React.forwardRef<SVGSVGElement, Props>(function SvgIcon(
  {
    color: providedColor = 'currentColor',
    size: providedSize = 'sm',
    viewBox = '0 0 16 16',
    ...props
  },
  ref
) {
  const color = theme[providedColor] ?? providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;

  return (
    <svg {...props} viewBox={viewBox} fill={color} height={size} width={size} ref={ref} />
  );
});

export default SvgIcon;
