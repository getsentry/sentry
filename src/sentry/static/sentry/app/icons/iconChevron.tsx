import React from 'react';
import {IconProps} from '../types/iconProps';
import theme from '../utils/theme';

export const IconChevron: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  direction: providedDirection = 'up',
  circle: providedCircle = false,
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
      {providedCircle === true ? (
        <g>
          <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
          <path d="M11.57,10.63a.79.79,0,0,1-.53-.22l-3-3-3,3A.75.75,0,0,1,3.9,9.35L7.47,5.78a.77.77,0,0,1,1.06,0L12.1,9.35a.75.75,0,0,1,0,1.06A.79.79,0,0,1,11.57,10.63Z" />
        </g>
      ) : (
        <g>
          <path d="M15.23,12.37a.79.79,0,0,1-.53-.22L8,5.44,1.3,12.15a.77.77,0,0,1-1.07,0,.75.75,0,0,1,0-1.06L7.47,3.85a.75.75,0,0,1,1.06,0l7.24,7.24a.75.75,0,0,1,0,1.06A.79.79,0,0,1,15.23,12.37Z" />
        </g>
      )}
    </svg>
  );
};
