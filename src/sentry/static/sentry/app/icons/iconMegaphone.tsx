import React from 'react';

import {IconProps} from 'app/types/iconProps';
import theme from 'app/utils/theme';

export const IconMegaphone: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...props
}: IconProps) => {
  const color = providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...props}>
      <path d="M12.53,12H9.92a.8.8,0,0,1-.42-.13L6.44,9.76H.76A.75.75,0,0,1,0,9V3A.75.75,0,0,1,.76,2.2H6.44L9.5.13A.8.8,0,0,1,9.92,0h2.61a.76.76,0,0,1,.75.75V11.21A.76.76,0,0,1,12.53,12Zm-2.38-1.5h1.63v-9H10.15L7.09,3.57a.77.77,0,0,1-.42.13H1.51V8.26H6.67a.77.77,0,0,1,.42.13Z" />
      <path d="M12.53,9.44V7.94a2,2,0,1,0,0-3.92V2.52a3.46,3.46,0,1,1,0,6.92Z" />
      <path d="M5.28,16H1.64a.76.76,0,0,1-.75-.75V9h1.5v5.53H4.53V9H6v6.28A.76.76,0,0,1,5.28,16Z" />
    </svg>
  );
};
