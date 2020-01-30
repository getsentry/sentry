import React from 'react';
import {IconProps} from '../types/iconProps';
import theme from '../utils/theme';

export const IconSearch: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...other
}: IconProps) => {
  const color = providedColor;
  const size =
    typeof providedSize === 'string' ? theme.iconSizes[providedSize] : providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...other}>
      <path d="M6,12A6,6,0,1,1,12,6,6,6,0,0,1,6,12ZM6,1.54A4.46,4.46,0,1,0,10.45,6,4.46,4.46,0,0,0,6,1.54Z" />
      <path d="M15.2,16a.74.74,0,0,1-.53-.22L9.14,10.2A.75.75,0,0,1,10.2,9.14l5.53,5.53a.75.75,0,0,1,0,1.06A.74.74,0,0,1,15.2,16Z" />
    </svg>
  );
};
