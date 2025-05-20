import {useId} from 'react';
import type {PopperProps} from 'react-popper';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {ColorOrAlias} from 'sentry/utils/theme';

export interface OverlayArrowProps extends React.ComponentPropsWithRef<'div'> {
  background?: ColorOrAlias;
  border?: ColorOrAlias;
  placement?: PopperProps<any>['placement'];
  ref?: React.Ref<HTMLDivElement>;
  size?: number;
  strokeWidth?: number;
}

export function OverlayArrow({
  size = 16,
  strokeWidth = 1,
  placement,
  background = 'backgroundElevated',
  border = 'translucentBorder',
  ref,
  ...props
}: OverlayArrowProps) {
  const theme = useTheme();

  const h = Math.round(size * 0.4);
  const w = size;
  const s = strokeWidth;

  const arrowPath = `
    M 0 ${h - s / 2},
    C ${w * 0.25} ${h - s / 2} ${w * 0.45} ${s / 2} ${w / 2} ${s / 2},
    C ${w * 0.55} ${s / 2} ${w * 0.75} ${h - s / 2} ${w} ${h - s / 2},
  `;

  const strokeMaskId = useId();
  const fillMaskId = useId();

  return (
    <Wrap ref={ref} placement={placement} size={size} {...props}>
      <SVG width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <mask id={strokeMaskId}>
            <rect x="0" y={-strokeWidth} width="100%" height="100%" fill="white" />
          </mask>
          <mask id={fillMaskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <path d={arrowPath} vectorEffect="non-scaling-stroke" stroke="black" />
          </mask>
        </defs>

        <path
          d={`${arrowPath} V ${h + 1} H 0 Z`}
          mask={`url(#${fillMaskId})`}
          fill={theme[background] as string}
        />
        <path
          d={arrowPath}
          mask={`url(#${strokeMaskId})`}
          stroke={theme[border] as string}
        />
      </SVG>
    </Wrap>
  );
}

const Wrap = styled('div')<{size: number; placement?: PopperProps<any>['placement']}>`
  position: relative;
  display: flex;
  width: ${p => p.size}px;
  height: ${p => p.size}px;

  ${p =>
    p.placement?.startsWith('top') &&
    `bottom: 0; transform: translateY(50%) rotate(180deg);`}
  ${p => p.placement?.startsWith('bottom') && `top: 0; transform: translateY(-50%) ;`}
  ${p =>
    p.placement?.startsWith('left') &&
    `right: 0; transform: translateX(50%) rotate(90deg);`}
  ${p =>
    p.placement?.startsWith('right') &&
    `left: 0; transform: translateX(-50%) rotate(-90deg);`}
`;

const SVG = styled('svg')`
  overflow: visible;
  position: absolute;
  bottom: 50%;
  fill: none;
  stroke: none;
`;
