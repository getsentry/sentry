import React from 'react';

import {IconProps} from 'app/types/iconProps';
import theme from 'app/utils/theme';

export const IconClickup = React.forwardRef(function IconClickup(
  {color: providedColor = 'currentColor', size: providedSize = 'sm', ...props}: IconProps,
  ref: React.Ref<SVGSVGElement>
) {
  const color = providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...props} ref={ref}>
      <path d="M1.33,12.29l2.46-1.88C5.1,12.11,6.49,12.9,8,12.9s2.88-.78,4.13-2.47l2.5,1.84A8.13,8.13,0,0,1,8,16C5.45,16,3.19,14.72,1.33,12.29Z" />
      <path d="M8,4.1,3.65,7.87l-2-2.34L8,0,14.4,5.53l-2,2.34Z" />
    </svg>
  );
});
