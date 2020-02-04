import React from 'react';

import {IconProps} from 'app/types/iconProps';
import theme from 'app/utils/theme';

export const IconActivity: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...props
}: IconProps) => {
  const color = providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...props}>
      <path d="M15.19,8.74H5.25a.75.75,0,0,1,0-1.5h9.94a.75.75,0,0,1,0,1.5Z" />
      <path d="M15.19,15H5.25a.75.75,0,1,1,0-1.5h9.94a.75.75,0,0,1,0,1.5Z" />
      <path d="M15.19,2.53H5.25a.75.75,0,0,1,0-1.5h9.94a.75.75,0,1,1,0,1.5Z" />
      <path d="M2.25,8.74H.71a.75.75,0,1,1,0-1.5H2.25a.75.75,0,0,1,0,1.5Z" />
      <path d="M2.25,15H.71a.75.75,0,0,1,0-1.5H2.25a.75.75,0,0,1,0,1.5Z" />
      <path d="M2.25,2.53H.71A.75.75,0,0,1,.71,1H2.25a.75.75,0,1,1,0,1.5Z" />
    </svg>
  );
};
