import React from 'react';
import {IconProps} from '../types/iconProps';
import theme from '../utils/theme';

export const IconPrint: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...other
}: IconProps) => {
  const color = providedColor;
  const size =
    typeof providedSize === 'string' ? theme.iconSizes[providedSize] : providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...other}>
      <path d="M13.12,16H2.88a.76.76,0,0,1-.75-.75V6a.76.76,0,0,1,.75-.75H13.12a.76.76,0,0,1,.75.75v9.21A.76.76,0,0,1,13.12,16Zm-9.49-1.5h8.74V6.77H3.63Z" />
      <path d="M13.25,12.12h-.13v-1.5h.13A1.25,1.25,0,0,0,14.5,9.38V2.75A1.25,1.25,0,0,0,13.25,1.5H2.75A1.25,1.25,0,0,0,1.5,2.75V9.38a1.25,1.25,0,0,0,1.25,1.24h.13v1.5H2.75A2.75,2.75,0,0,1,0,9.38V2.75A2.75,2.75,0,0,1,2.75,0h10.5A2.75,2.75,0,0,1,16,2.75V9.38A2.75,2.75,0,0,1,13.25,12.12Z" />
      <path d="M11.08,10H4.92a.75.75,0,0,1,0-1.5h6.16a.75.75,0,1,1,0,1.5Z" />
      <path d="M4.43,3.61H2.88a.75.75,0,0,1,0-1.5H4.43a.75.75,0,0,1,0,1.5Z" />
      <path d="M11.08,12.8H4.92a.75.75,0,1,1,0-1.5h6.16a.75.75,0,1,1,0,1.5Z" />
    </svg>
  );
};
