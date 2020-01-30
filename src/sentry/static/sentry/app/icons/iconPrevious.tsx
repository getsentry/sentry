import React from 'react';
import {IconProps} from '../types/iconProps';
import theme from '../utils/theme';

export const IconPrevious: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...other
}: IconProps) => {
  const color = providedColor;
  const size =
    typeof providedSize === 'string' ? theme.iconSizes[providedSize] : providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...other}>
      <path d="M15.25,15.48a.69.69,0,0,1-.37-.1L3.22,8.65a.75.75,0,0,1,0-1.3L14.88.62a.75.75,0,0,1,.74,0,.73.73,0,0,1,.38.65V14.73a.73.73,0,0,1-.38.65A.69.69,0,0,1,15.25,15.48ZM5.09,8l9.41,5.43V2.57Z" />
      <path d="M.75,15.94A.76.76,0,0,1,0,15.19V.81A.76.76,0,0,1,.75.06.76.76,0,0,1,1.5.81V15.19A.76.76,0,0,1,.75,15.94Z" />
    </svg>
  );
};
