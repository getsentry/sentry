import React from 'react';

import {IconProps} from 'app/types/iconProps';
import theme from 'app/utils/theme';

export const IconProjects: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...props
}: IconProps) => {
  const color = providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...props}>
      <path d="M13.25,16H2.75A2.75,2.75,0,0,1,0,13.25V2.75A2.75,2.75,0,0,1,2.75,0h10.5A2.75,2.75,0,0,1,16,2.75v10.5A2.75,2.75,0,0,1,13.25,16ZM2.75,1.5A1.25,1.25,0,0,0,1.5,2.75v10.5A1.25,1.25,0,0,0,2.75,14.5h10.5a1.25,1.25,0,0,0,1.25-1.25V2.75A1.25,1.25,0,0,0,13.25,1.5Z" />
      <path d="M5.8,7.3H4.39a1.5,1.5,0,0,1-1.5-1.5V4.39a1.5,1.5,0,0,1,1.5-1.5H5.8a1.5,1.5,0,0,1,1.5,1.5V5.8A1.51,1.51,0,0,1,5.8,7.3Zm0-1.5v0ZM4.39,4.39V5.8h1.4V4.39Z" />
      <path d="M11.61,7.3H10.2A1.51,1.51,0,0,1,8.7,5.8V4.39a1.5,1.5,0,0,1,1.5-1.5h1.41a1.5,1.5,0,0,1,1.5,1.5V5.8A1.5,1.5,0,0,1,11.61,7.3Zm0-1.5v0ZM10.2,4.39V5.8h1.41V4.39Z" />
      <path d="M5.8,13.11H4.39a1.5,1.5,0,0,1-1.5-1.5V10.2a1.5,1.5,0,0,1,1.5-1.5H5.8a1.51,1.51,0,0,1,1.5,1.5v1.41A1.5,1.5,0,0,1,5.8,13.11Zm0-1.5v0ZM4.39,10.2v1.41h1.4V10.2Z" />
      <path d="M11.61,13.11H10.2a1.5,1.5,0,0,1-1.5-1.5V10.2a1.51,1.51,0,0,1,1.5-1.5h1.41a1.5,1.5,0,0,1,1.5,1.5v1.41A1.5,1.5,0,0,1,11.61,13.11Zm0-1.5v0ZM10.2,10.2v1.41h1.41V10.2Z" />
    </svg>
  );
};
