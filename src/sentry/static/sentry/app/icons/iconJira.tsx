import React from 'react';
import {IconProps} from '../types/iconProps';
import theme from '../utils/theme';

export const IconJira: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...other
}: IconProps) => {
  const color = providedColor;
  const size =
    typeof providedSize === 'string' ? theme.iconSizes[providedSize] : providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...other}>
      <path d="M15.83,7.57l0,0h0L8.69.67,8,0,2.64,5.18.19,7.55a.63.63,0,0,0,0,.88l0,0,4.9,4.73L8,16l5.36-5.18.08-.08,2.37-2.29A.63.63,0,0,0,15.83,7.57ZM8,10.37H8L5.55,8,8,5.63,10.45,8Z" />
    </svg>
  );
};
