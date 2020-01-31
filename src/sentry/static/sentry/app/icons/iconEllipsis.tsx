import React from 'react';
import {IconProps} from 'app/types/iconProps';
import theme from 'app/utils/theme';

export const IconEllipsis: React.FC<IconProps> = ({
  color: providedColor = 'currentColor',
  size: providedSize = 'sm',
  ...props
}: IconProps) => {
  const color = providedColor;
  const size =
    typeof providedSize === 'string' ? theme.iconSizes[providedSize] : providedSize;

  return (
    <svg viewBox="0 0 16 16" fill={color} height={size} width={size} {...props}>
      <circle cx="8" cy="8" r="1.31" />
      <circle cx="1.31" cy="8" r="1.31" />
      <circle cx="14.69" cy="8" r="1.31" />
    </svg>
  );
};
