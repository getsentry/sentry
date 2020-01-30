import React from 'react';
import {IconProps} from '../types/iconProps';
import theme from '../utils/theme';

export const IconFile: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...other
}: IconProps) => {
  const color = providedColor;
  const size =
    typeof providedSize === 'string' ? theme.iconSizes[providedSize] : providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...other}>
      <path d="M13.34,16H2.67A1.75,1.75,0,0,1,.92,14.27V1.76A1.75,1.75,0,0,1,2.67,0H8.82a.75.75,0,0,1,.53.22l5.52,5.52a.75.75,0,0,1,.22.53v8A1.75,1.75,0,0,1,13.34,16ZM2.67,1.51a.25.25,0,0,0-.25.25V14.27a.25.25,0,0,0,.25.25H13.34a.25.25,0,0,0,.25-.25V6.59L8.51,1.51Z" />
      <path d="M14.34,7H9.82A1.75,1.75,0,0,1,8.07,5.28V.76a.75.75,0,1,1,1.5,0V5.28a.25.25,0,0,0,.25.25h4.52a.75.75,0,0,1,0,1.5Z" />
    </svg>
  );
};
