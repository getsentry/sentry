import React from 'react';
import {IconProps} from '../types/iconProps';
import theme from '../utils/theme';

export const IconLocation: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  solid: providedSolid = false,
  ...other
}: IconProps) => {
  const color = providedColor;
  const size =
    typeof providedSize === 'string' ? theme.iconSizes[providedSize] : providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...other}>
      {providedSolid === true ? (
        <g>
          <path d="M8,16a.74.74,0,0,1-.45-.15c-4-3-6.09-6.16-6.09-9.29A6.55,6.55,0,0,1,8,0a6.54,6.54,0,0,1,6.54,6.54c0,3.14-2,6.26-6.09,9.29A.74.74,0,0,1,8,16ZM8,4.05a2,2,0,1,0,2,2A2,2,0,0,0,8,4.05Z" />
        </g>
      ) : (
        <g>
          <path d="M8,16a.74.74,0,0,1-.45-.15c-4-3-6.09-6.16-6.09-9.29A6.55,6.55,0,0,1,8,0a6.54,6.54,0,0,1,6.54,6.54c0,3.14-2,6.26-6.09,9.29A.74.74,0,0,1,8,16ZM8,1.51a5,5,0,0,0-5,5c0,2.53,1.69,5.13,5,7.74,3.34-2.61,5-5.21,5-7.74a5,5,0,0,0-5-5Z" />
          <path d="M8,8.85a2.78,2.78,0,1,1,2.77-2.77A2.78,2.78,0,0,1,8,8.85Zm0-4A1.28,1.28,0,1,0,9.27,6.08,1.27,1.27,0,0,0,8,4.8Z" />
        </g>
      )}
    </svg>
  );
};
