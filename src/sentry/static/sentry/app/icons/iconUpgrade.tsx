import React from 'react';
import {IconProps} from '../types/iconProps';
import theme from '../utils/theme';

export const IconUpgrade: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...other
}: IconProps) => {
  const color = providedColor;
  const size =
    typeof providedSize === 'string' ? theme.iconSizes[providedSize] : providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...other}>
      <path d="M11.54,7.5A.79.79,0,0,1,11,7.28l-3-3-3,3a.75.75,0,0,1-1.06,0,.74.74,0,0,1,0-1.06L7.47,2.67a.77.77,0,0,1,1.06,0l3.54,3.55a.74.74,0,0,1,0,1.06A.77.77,0,0,1,11.54,7.5Z" />
      <path d="M8,12.8a.76.76,0,0,1-.75-.75V3.2a.75.75,0,1,1,1.5,0v8.85A.76.76,0,0,1,8,12.8Z" />
      <path d="M13.25,16H2.75A2.75,2.75,0,0,1,0,13.25V2.75A2.75,2.75,0,0,1,2.75,0h10.5A2.75,2.75,0,0,1,16,2.75v10.5A2.75,2.75,0,0,1,13.25,16ZM2.75,1.5A1.25,1.25,0,0,0,1.5,2.75v10.5A1.25,1.25,0,0,0,2.75,14.5h10.5a1.25,1.25,0,0,0,1.25-1.25V2.75A1.25,1.25,0,0,0,13.25,1.5Z" />
    </svg>
  );
};
