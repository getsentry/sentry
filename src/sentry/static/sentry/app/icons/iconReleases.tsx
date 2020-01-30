import React from 'react';
import {IconProps} from '../types/iconProps';
import theme from '../utils/theme';

export const IconReleases: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...other
}: IconProps) => {
  const color = providedColor;
  const size =
    typeof providedSize === 'string' ? theme.iconSizes[providedSize] : providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...other}>
      <path d="M14.77,16H1.23A1.26,1.26,0,0,1,0,14.75V6.52A1.25,1.25,0,0,1,1.23,5.27H14.77A1.25,1.25,0,0,1,16,6.52v8.23A1.26,1.26,0,0,1,14.77,16ZM1.48,14.5h13V6.77h-13Z" />
      <path d="M14.71,6h-1.5V4.14H2.79V6H1.29V3.89A1.25,1.25,0,0,1,2.54,2.64H13.46a1.25,1.25,0,0,1,1.25,1.25Z" />
      <path d="M13.37,3.39h-1.5V1.5H4.13V3.39H2.63V1.25A1.26,1.26,0,0,1,3.88,0h8.24a1.26,1.26,0,0,1,1.25,1.25Z" />
    </svg>
  );
};
