import React from 'react';
import {IconProps} from '../types/iconProps';
import theme from '../utils/theme';

export const IconReturn: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...other
}: IconProps) => {
  const color = providedColor;
  const size =
    typeof providedSize === 'string' ? theme.iconSizes[providedSize] : providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...other}>
      <path d="M3.89,15.06a.74.74,0,0,1-.53-.22L.24,11.72a.75.75,0,0,1,0-1.06L3.36,7.55a.74.74,0,0,1,1.06,0,.75.75,0,0,1,0,1.06L1.83,11.19l2.59,2.59a.75.75,0,0,1,0,1.06A.74.74,0,0,1,3.89,15.06Z" />
      <path d="M15,11.94H.77a.75.75,0,1,1,0-1.5H14.21V2.88H4.49a.75.75,0,0,1,0-1.5H15a.75.75,0,0,1,.75.75v9.06A.74.74,0,0,1,15,11.94Z" />
    </svg>
  );
};
