import React from 'react';

import {IconProps} from 'app/types/iconProps';
import theme from 'app/utils/theme';

export const IconLab: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...props
}: IconProps) => {
  const color = providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...props}>
      <path d="M8,13.29a2.5,2.5,0,1,1,2.5-2.5A2.5,2.5,0,0,1,8,13.29Zm0-3.5a1,1,0,1,0,1,1A1,1,0,0,0,8,9.79Z" />
      <path d="M11.31,16H4.68a3.45,3.45,0,0,1-3.49-3.4,3.34,3.34,0,0,1,.58-1.88L5.12,5.83V3.89H5a1.51,1.51,0,0,1-1.51-1.5V1.51A1.52,1.52,0,0,1,5,0h6a1.52,1.52,0,0,1,1.51,1.51v.88A1.51,1.51,0,0,1,11,3.89h-.1V5.83l3.35,4.89a3.34,3.34,0,0,1,.58,1.88A3.46,3.46,0,0,1,11.31,16ZM5,1.5v.89h.88a.75.75,0,0,1,.75.75V6.07a.7.7,0,0,1-.13.42L3,11.57a1.82,1.82,0,0,0-.32,1,2,2,0,0,0,2,1.9h6.63a2,2,0,0,0,2-1.9,1.82,1.82,0,0,0-.32-1L9.51,6.49a.7.7,0,0,1-.13-.42V3.14a.75.75,0,0,1,.75-.75H11V1.51Z" />
    </svg>
  );
};
