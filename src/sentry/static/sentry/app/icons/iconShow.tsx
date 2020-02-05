import React from 'react';

import {IconProps} from 'app/types/iconProps';
import theme from 'app/utils/theme';

export const IconShow: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...props
}: IconProps) => {
  const color = providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...props}>
      <path d="M8,14.16c-3.67,0-6.18-1.87-7.9-5.86a.78.78,0,0,1,0-.6c1.72-4,4.23-5.86,7.9-5.86s6.18,1.87,7.9,5.86a.78.78,0,0,1,0,.6C14.18,12.29,11.67,14.16,8,14.16ZM1.61,8C3.07,11.22,5.05,12.66,8,12.66S12.93,11.22,14.39,8C12.93,4.78,11,3.34,8,3.34S3.07,4.78,1.61,8Z" />
      <circle cx="8" cy="8" r="3.61" />
    </svg>
  );
};
