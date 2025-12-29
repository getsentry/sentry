import type {PopperProps} from 'react-popper';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {ColorOrAlias} from 'sentry/utils/theme';

export interface OverlayArrowProps extends React.ComponentPropsWithRef<'div'> {
  background?: ColorOrAlias | string;
  border?: ColorOrAlias | string;
  placement?: PopperProps<any>['placement'];
  ref?: React.Ref<HTMLDivElement>;
  size?: number;
  strokeWidth?: number;
}

export const OverlayArrow = ChonkOverlayArrow;

const sizeRatio = 0.5;
const heightRatio = 0.3;

function ChonkOverlayArrow({
  placement,
  ref,
  size = 16,
  background,
  border,
  ...props
}: OverlayArrowProps) {
  const theme = useTheme();

  const offset = placement?.startsWith('top') ? 3 : 1.5;
  const topOffset = placement?.startsWith('top') ? 3 : 1;

  return (
    <ChonkWrap dimensions={size} ref={ref} placement={placement} {...props}>
      <svg
        viewBox={`0 0 ${size} ${size * sizeRatio}`}
        fill="none"
        style={{display: 'block'}}
      >
        {placement?.startsWith('left') || placement?.startsWith('right') ? (
          <polygon
            transform={`translate(${placement?.startsWith('right') ? 2 : 0}, 0)`}
            points={`
              -2,0
              ${size},0
              ${size / 2},${size * heightRatio + topOffset}
              ${size / 2 - 2},${size * heightRatio + topOffset}`}
            fill={
              border
                ? ((theme[border as ColorOrAlias] as string) ?? border)
                : theme.tokens.border.primary
            }
          />
        ) : null}
        <polygon
          points={`0,0 ${size},0 ${size / 2},${size * heightRatio + topOffset}`}
          fill={
            border
              ? ((theme[border as ColorOrAlias] as string) ?? border)
              : theme.tokens.border.primary
          }
        />
        <polygon
          points={`${offset},0 ${size - offset}, 0 ${size / 2},${size * heightRatio}`}
          fill={
            background
              ? ((theme[background as ColorOrAlias] as string) ?? background)
              : theme.tokens.background.primary
          }
        />
      </svg>
    </ChonkWrap>
  );
}

const ChonkWrap = styled('div')<{
  dimensions: number;
  placement?: PopperProps<any>['placement'];
}>`
  width: ${p => p.dimensions}px;
  height: ${p =>
    p.placement?.startsWith('left') || p.placement?.startsWith('right')
      ? p.dimensions
      : p.dimensions * sizeRatio}px;
  position: absolute;
  transform-origin: center;

  ${p =>
    p.placement?.startsWith('top') && `top: 100%; left: 50%; transform: rotate(0deg);`}
  ${p =>
    p.placement?.startsWith('bottom') &&
    `bottom: 100%; left: 50%; transform: rotate(180deg);`}
  ${p =>
    p.placement?.startsWith('left') && `left: 100%; top: 50%; transform: rotate(-90deg);`}
  ${p =>
    p.placement?.startsWith('right') &&
    `right: 100%; top: 50%; transform: rotate(90deg);`}
`;
