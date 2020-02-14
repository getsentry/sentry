import React from 'react';

import {IconProps} from 'app/types/iconProps';
import theme from 'app/utils/theme';

export const IconToggle: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...props
}: IconProps) => {
  const color = providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...props}>
      <circle cx="5.36" cy="8" r="3.08" />
      <path d="M10.68,13.34H5.32a5.34,5.34,0,0,1,0-10.68h5.36a5.34,5.34,0,0,1,0,10.68ZM5.32,4.16a3.84,3.84,0,0,0,0,7.68h5.36a3.84,3.84,0,0,0,0-7.68Z" />
    </svg>
  );
};
