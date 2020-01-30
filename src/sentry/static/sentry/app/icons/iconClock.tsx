import React from 'react';
import {IconProps} from '../types/iconProps';
import theme from '../utils/theme';

export const IconClock: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...other
}: IconProps) => {
  const color = providedColor;
  const size =
    typeof providedSize === 'string' ? theme.iconSizes[providedSize] : providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...other}>
      <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.52A6.48,6.48,0,1,0,14.48,8,6.49,6.49,0,0,0,8,1.52Z" />
      <path d="M11.62,8.75H8A.76.76,0,0,1,7.25,8V2.88a.75.75,0,1,1,1.5,0V7.25h2.87a.75.75,0,0,1,0,1.5Z" />
    </svg>
  );
};
