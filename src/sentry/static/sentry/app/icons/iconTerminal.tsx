import React from 'react';

import {IconProps} from 'app/types/iconProps';
import theme from 'app/utils/theme';

export const IconTerminal = React.forwardRef(function IconTerminal(
  {color: providedColor = 'currentColor', size: providedSize = 'sm', ...props}: IconProps,
  ref: React.Ref<SVGSVGElement>
) {
  const color = providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;

  return (
    <svg
      viewBox="0 0 471.362 471.362"
      fill={color}
      height={size}
      width={size}
      {...props}
      ref={ref}
    >
      <path d="M468.794 355.171c-1.707-1.718-3.897-2.57-6.563-2.57H188.145c-2.664 0-4.854.853-6.567 2.57-1.711 1.711-2.565 3.897-2.565 6.563v18.274c0 2.662.854 4.853 2.565 6.563 1.713 1.712 3.903 2.57 6.567 2.57h274.086c2.666 0 4.856-.858 6.563-2.57 1.711-1.711 2.567-3.901 2.567-6.563v-18.274c.004-2.666-.848-4.852-2.567-6.563zM30.259 85.075c-1.903-1.903-4.093-2.856-6.567-2.856s-4.661.953-6.563 2.856L2.852 99.353C.95 101.255 0 103.442 0 105.918c0 2.478.95 4.664 2.852 6.567L115.06 224.69 2.852 336.896C.95 338.799 0 340.989 0 343.46c0 2.478.95 4.665 2.852 6.567L17.128 364.3c1.903 1.906 4.089 2.854 6.563 2.854s4.665-.951 6.567-2.854l133.048-133.045c1.903-1.902 2.853-4.096 2.853-6.57 0-2.473-.95-4.663-2.853-6.565L30.259 85.075z" />
    </svg>
  );
});
