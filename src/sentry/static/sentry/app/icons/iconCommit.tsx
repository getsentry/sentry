import React from 'react';
import {IconProps} from '../types/iconProps';
import theme from '../utils/theme';

export const IconCommit: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...other
}: IconProps) => {
  const color = providedColor;
  const size =
    typeof providedSize === 'string' ? theme.iconSizes[providedSize] : providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...other}>
      <path d="M8,11.91A3.91,3.91,0,1,1,11.91,8,3.91,3.91,0,0,1,8,11.91ZM8,5.59A2.41,2.41,0,1,0,10.41,8,2.41,2.41,0,0,0,8,5.59Z" />
      <path d="M15.23,8.75H11.16a.75.75,0,0,1,0-1.5h4.07a.75.75,0,0,1,0,1.5Z" />
      <path d="M4.84,8.75H.77a.75.75,0,1,1,0-1.5H4.84a.75.75,0,0,1,0,1.5Z" />
    </svg>
  );
};
