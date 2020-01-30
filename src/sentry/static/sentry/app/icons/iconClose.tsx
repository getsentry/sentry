import React from 'react';
import {IconProps} from '../types/iconProps';
import theme from '../utils/theme';

export const IconClose: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  circle: providedCircle = false,
  ...other
}: IconProps) => {
  const color = providedColor;
  const size =
    typeof providedSize === 'string' ? theme.iconSizes[providedSize] : providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...other}>
      {providedCircle === true ? (
        <g>
          <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
          <path d="M5.34,11.41a.71.71,0,0,1-.53-.22.74.74,0,0,1,0-1.06l5.32-5.32a.75.75,0,0,1,1.06,1.06L5.87,11.19A.74.74,0,0,1,5.34,11.41Z" />
          <path d="M10.66,11.41a.74.74,0,0,1-.53-.22L4.81,5.87A.75.75,0,0,1,5.87,4.81l5.32,5.32a.74.74,0,0,1,0,1.06A.71.71,0,0,1,10.66,11.41Z" />
        </g>
      ) : (
        <g>
          <path d="M15.13,15.88a.77.77,0,0,1-.53-.22L.34,1.4A.75.75,0,0,1,1.4.34L15.66,14.6a.75.75,0,0,1,0,1.06A.79.79,0,0,1,15.13,15.88Z" />
          <path d="M.87,15.88a.79.79,0,0,1-.53-.22.75.75,0,0,1,0-1.06L14.6.34A.75.75,0,0,1,15.66,1.4L1.4,15.66A.77.77,0,0,1,.87,15.88Z" />
        </g>
      )}
    </svg>
  );
};
