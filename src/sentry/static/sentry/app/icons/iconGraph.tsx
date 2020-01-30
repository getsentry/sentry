import React from 'react';
import {IconProps} from '../types/iconProps';
import theme from '../utils/theme';

export const IconGraph: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  type: providedType = 'line',
  ...other
}: IconProps) => {
  const color = providedColor;
  const size =
    typeof providedSize === 'string' ? theme.iconSizes[providedSize] : providedSize;

  const bar = (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...other}>
      <g>
        <path d="M4.06,16H.74A.75.75,0,0,1,0,15.24v-4a.74.74,0,0,1,.75-.75H4.06a.75.75,0,0,1,.75.75v4A.76.76,0,0,1,4.06,16Zm-2.57-1.5H3.31V12H1.49Z" />
        <path d="M9.65,16H6.33a.76.76,0,0,1-.75-.75V6.06a.75.75,0,0,1,.75-.75H9.65a.74.74,0,0,1,.75.75v9.18A.75.75,0,0,1,9.65,16Zm-2.57-1.5H8.9V6.81H7.08Z" />
        <path d="M15.25,16H11.93a.75.75,0,0,1-.75-.75V.76A.75.75,0,0,1,11.93,0h3.32A.76.76,0,0,1,16,.76V15.24A.76.76,0,0,1,15.25,16Zm-2.57-1.5H14.5v-13H12.68Z" />
      </g>
    </svg>
  );

  const circle = (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...other}>
      <g>
        <path d="M13.1,15.09a.74.74,0,0,1-.5-.2l-6-5.48a.76.76,0,0,1-.24-.55V.76A.76.76,0,0,1,7.14,0a8.85,8.85,0,0,1,6.52,14.84A.76.76,0,0,1,13.1,15.09ZM7.89,8.53,13,13.25A7.34,7.34,0,0,0,7.89,1.55Z" />
        <path d="M7.14,16a7.13,7.13,0,0,1,0-14.26v1.5a5.63,5.63,0,1,0,4.15,9.44l1.1,1A7.12,7.12,0,0,1,7.14,16Z" />
      </g>
    </svg>
  );

  const line = (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...other}>
      <g>
        <path d="M15.25,16H.75A.76.76,0,0,1,0,15.25V.75A.76.76,0,0,1,.75,0,.76.76,0,0,1,1.5.75V14.5H15.25a.75.75,0,0,1,0,1.5Z" />
        <path d="M.75,16a.8.8,0,0,1-.36-.09.75.75,0,0,1-.3-1L5.92,4.16a.78.78,0,0,1,1.32,0L9.71,8.72,14.6.38a.75.75,0,1,1,1.3.76l-5.57,9.48a.75.75,0,0,1-1.3,0L6.58,6.09,1.41,15.61A.75.75,0,0,1,.75,16Z" />
      </g>
    </svg>
  );

  switch (providedType) {
    case 'bar':
      return bar;
    case 'circle':
      return circle;
    default:
      return line;
  }
};
