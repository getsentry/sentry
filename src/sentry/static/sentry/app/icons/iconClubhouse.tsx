import React from 'react';

import {IconProps} from 'app/types/iconProps';
import theme from 'app/utils/theme';

export const IconClubhouse = React.forwardRef(function IconClubhouse(
  {color: providedColor = 'currentColor', size: providedSize = 'sm', ...props}: IconProps,
  ref: React.Ref<SVGSVGElement>
) {
  const color = providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...props} ref={ref}>
      <path d="M1.19,11.89a1.16,1.16,0,1,0,1.15,1.16A1.16,1.16,0,0,0,1.19,11.89Z" />
      <path d="M15.43,1.79,8.14,4.12V1.82L.29,4.33V11L7.06,8.82v2.29L16,8.27,13.56,5.91ZM7.06,7.68,1.38,9.5V5.12L7.06,3.3Zm6.89.1L8.14,9.63V5.26L13.5,3.55,12.27,6.14Z" />
    </svg>
  );
});
