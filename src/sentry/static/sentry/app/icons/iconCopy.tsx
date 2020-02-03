import React from 'react';

import {IconProps} from 'app/types/iconProps';
import theme from 'app/utils/theme';

export const IconCopy: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...props
}: IconProps) => {
  const color = providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...props}>
      <path d="M14.24,12.49H5.58a1.75,1.75,0,0,1-1.75-1.75v-9A1.75,1.75,0,0,1,5.58,0h8.66A1.75,1.75,0,0,1,16,1.74v9A1.75,1.75,0,0,1,14.24,12.49Zm-8.66-11a.25.25,0,0,0-.25.25v9a.25.25,0,0,0,.25.25h8.66a.25.25,0,0,0,.25-.25v-9a.25.25,0,0,0-.25-.25Z" />
      <path d="M10.38,16H1.72A1.75,1.75,0,0,1,0,14.26v-9A1.75,1.75,0,0,1,1.72,3.51H4.58a.75.75,0,0,1,0,1.5H1.72a.25.25,0,0,0-.25.25v9a.25.25,0,0,0,.25.25h8.66a.25.25,0,0,0,.25-.25V11.74a.75.75,0,0,1,1.5,0v2.52A1.75,1.75,0,0,1,10.38,16Z" />
    </svg>
  );
};
