import React from 'react';
import styled from '@emotion/styled';

import {IconProps} from 'app/types/iconProps';
import theme from 'app/utils/theme';

export const IconArrow = React.forwardRef(function IconArrow(
  {
    color: providedColor = 'currentColor',
    size: providedSize = 'sm',
    direction: providedDirection = 'up',
    ...props
  }: IconProps,
  ref: React.Ref<SVGSVGElement>
) {
  const color = providedColor;
  const size = theme.iconSizes[providedSize] ?? providedSize;
  const direction =
    typeof providedDirection === 'string'
      ? theme.iconDirections[providedDirection]
      : providedDirection;

  return (
    <StyledSvg
      viewBox="0 0 16 16"
      fill={color}
      height={size}
      width={size}
      direction={direction}
      {...props}
      ref={ref}
    >
      <path d="M13.76,7.32a.74.74,0,0,1-.53-.22L8,1.87,2.77,7.1A.75.75,0,1,1,1.71,6L7.47.28a.74.74,0,0,1,1.06,0L14.29,6a.75.75,0,0,1,0,1.06A.74.74,0,0,1,13.76,7.32Z" />
      <path d="M8,15.94a.75.75,0,0,1-.75-.75V.81a.75.75,0,0,1,1.5,0V15.19A.75.75,0,0,1,8,15.94Z" />
    </StyledSvg>
  );
});

const StyledSvg = styled('svg')<{direction: string}>`
  transform: rotate(${p => p.direction}deg);
`;
