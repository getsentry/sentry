import React from 'react';

import {IconProps} from 'app/types/iconProps';
import theme from 'app/utils/theme';

export const IconGrabbable = React.forwardRef(function IconGrabbable(
  {color: providedColor = 'currentColor', size: providedSize = 'sm', ...props}: IconProps,
  ref: React.Ref<SVGSVGElement>
) {
  const color = providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...props} ref={ref}>
      <circle cx="4.73" cy="8" r="1.31" />
      <circle cx="4.73" cy="1.31" r="1.31" />
      <circle cx="11.27" cy="8" r="1.31" />
      <circle cx="11.27" cy="1.31" r="1.31" />
      <circle cx="4.73" cy="14.69" r="1.31" />
      <circle cx="11.27" cy="14.69" r="1.31" />
    </svg>
  );
});
