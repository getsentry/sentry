import React from 'react';
import {IconProps} from '../types/iconProps';
import theme from '../utils/theme';

export const IconGitlab: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...other
}: IconProps) => {
  const color = providedColor;
  const size =
    typeof providedSize === 'string' ? theme.iconSizes[providedSize] : providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...other}>
      <path d="M8,15.37.25,9.74A.62.62,0,0,1,0,9.06L.92,6.3,2.7.84A.3.3,0,0,1,3,.63a.31.31,0,0,1,.29.21L5.05,6.3h5.89L12.72.84a.31.31,0,0,1,.58,0L15.07,6.3,16,9.06a.61.61,0,0,1-.23.68Z" />
    </svg>
  );
};
