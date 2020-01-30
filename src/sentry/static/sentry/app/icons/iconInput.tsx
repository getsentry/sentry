import React from 'react';
import {IconProps} from '../types/iconProps';
import theme from '../utils/theme';

export const IconInput: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...other
}: IconProps) => {
  const color = providedColor;
  const size =
    typeof providedSize === 'string' ? theme.iconSizes[providedSize] : providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...other}>
      <path d="M13.25,16H2.75A2.75,2.75,0,0,1,0,13.25V2.75A2.75,2.75,0,0,1,2.75,0h10.5A2.75,2.75,0,0,1,16,2.75v10.5A2.75,2.75,0,0,1,13.25,16ZM2.75,1.5A1.25,1.25,0,0,0,1.5,2.75v10.5A1.25,1.25,0,0,0,2.75,14.5h10.5a1.25,1.25,0,0,0,1.25-1.25V2.75A1.25,1.25,0,0,0,13.25,1.5Z" />
      <rect x="3.15" y="3.58" width="1.5" height="8.83" />
      <path d="M4.9,13.17h-2a.75.75,0,0,1,0-1.5h2a.75.75,0,0,1,0,1.5Z" />
      <path d="M4.9,4.33h-2a.75.75,0,0,1,0-1.5h2a.75.75,0,0,1,0,1.5Z" />
    </svg>
  );
};
