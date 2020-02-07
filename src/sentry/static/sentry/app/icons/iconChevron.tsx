import React from 'react';

import {IconProps} from 'app/types/iconProps';
import theme from 'app/utils/theme';

export const IconChevron: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  direction: providedDirection = 'up',
  circle: providedCircle = false,
  ...props
}: IconProps) => {
  const color = providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;
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
      transform={`rotate(${direction})`}
      {...props}
    >
      {providedCircle === true ? (
        <g>
          <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
          <path d="M11.12,9.87a.73.73,0,0,1-.53-.22L8,7.07,5.41,9.65a.74.74,0,0,1-1.06,0,.75.75,0,0,1,0-1.06L7.47,5.48a.74.74,0,0,1,1.06,0l3.12,3.11a.75.75,0,0,1,0,1.06A.74.74,0,0,1,11.12,9.87Z" />
        </g>
      ) : (
        <g>
          <path d="M15.23,12.37a.79.79,0,0,1-.53-.22L8,5.44,1.3,12.15a.77.77,0,0,1-1.07,0,.75.75,0,0,1,0-1.06L7.47,3.85a.75.75,0,0,1,1.06,0l7.24,7.24a.75.75,0,0,1,0,1.06A.79.79,0,0,1,15.23,12.37Z" />
        </g>
      )}
    </svg>
  );
};
