import React from 'react';
import {IconProps} from '../types/iconProps';
import theme from '../utils/theme';

export const IconSliders: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  direction: providedDirection = 'up',
  ...other
}: IconProps) => {
  const color = providedColor;
  const size =
    typeof providedSize === 'string' ? theme.iconSizes[providedSize] : providedSize;
  const direction =
    typeof providedDirection === 'string'
      ? theme.iconDirections[providedDirection]
      : providedDirection;

  return (
    <svg
      viewBox="0 0 16 16"
      fill={color}
      height={size}
      width={size}
      transform={'rotate(' + direction + ')'}
      {...other}
    >
      <path d="M4.33,14a2.86,2.86,0,1,1,2.86-2.85A2.86,2.86,0,0,1,4.33,14Zm0-4.21a1.36,1.36,0,1,0,1.36,1.36A1.35,1.35,0,0,0,4.33,9.75Z" />
      <path d="M11.71,7.75a2.86,2.86,0,1,1,2.85-2.86A2.86,2.86,0,0,1,11.71,7.75Zm0-4.21a1.36,1.36,0,1,0,1.35,1.35A1.36,1.36,0,0,0,11.71,3.54Z" />
      <path d="M15.19,11.86H6.44a.75.75,0,0,1,0-1.5h8.75a.75.75,0,0,1,0,1.5Z" />
      <path d="M2.23,11.86H.81a.75.75,0,0,1,0-1.5H2.23a.75.75,0,1,1,0,1.5Z" />
      <path d="M15.19,5.64H13.81a.75.75,0,0,1,0-1.5h1.38a.75.75,0,0,1,0,1.5Z" />
      <path d="M9.6,5.64H.81a.75.75,0,1,1,0-1.5H9.6a.75.75,0,0,1,0,1.5Z" />
    </svg>
  );
};
