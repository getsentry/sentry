import React from 'react';
import {IconProps} from '../types/iconProps';
import theme from '../utils/theme';

export const IconRefresh: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...other
}: IconProps) => {
  const color = providedColor;
  const size =
    typeof providedSize === 'string' ? theme.iconSizes[providedSize] : providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...other}>
      <path d="M11.14,6.35a.76.76,0,0,1-.75-.75v-4a.75.75,0,0,1,.75-.75h4a.75.75,0,1,1,0,1.5H11.89V5.6A.76.76,0,0,1,11.14,6.35Z" />
      <path d="M8,15.9A7.9,7.9,0,0,1,8,.1.75.75,0,0,1,8,1.6a6.39,6.39,0,1,0,2.81.65A.75.75,0,1,1,11.48.91,7.83,7.83,0,0,1,15.9,8,7.91,7.91,0,0,1,8,15.9Z" />
    </svg>
  );
};
