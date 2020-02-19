import React from 'react';

import {IconProps} from 'app/types/iconProps';
import theme from 'app/utils/theme';

export const IconEvent: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...props
}: IconProps) => {
  const color = providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...props}>
      <path d="M8,12.92a.69.69,0,0,1-.37-.1L.43,8.65a.75.75,0,0,1,0-1.3L7.66,3.18a.77.77,0,0,1,.75,0l7.23,4.17a.76.76,0,0,1,0,1.3L8.41,12.82A.75.75,0,0,1,8,12.92ZM2.3,8,8,11.3,13.76,8,8,4.7Z" />
    </svg>
  );
};
