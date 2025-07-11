import {useId} from 'react';
import type {PopperProps} from 'react-popper';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import type {ColorOrAlias} from 'sentry/utils/theme';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';
import {withChonk} from 'sentry/utils/theme/withChonk';

export interface OverlayArrowProps extends React.ComponentPropsWithRef<'div'> {
  background?: ColorOrAlias;
  border?: ColorOrAlias;
  placement?: PopperProps<any>['placement'];
  ref?: React.Ref<HTMLDivElement>;
  size?: number;
  strokeWidth?: number;
}

export const OverlayArrow = withChonk(LegacyOverlayArrow, ChonkOverlayArrow);

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
  const sizeRatio = 0.5;
  const heightRatio = 0.3;

  return (
    <ChonkWrap size={size} ref={ref} placement={placement} {...props}>
      <svg
        width={size * sizeRatio}
        height={size * sizeRatio}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
      >
        {placement?.startsWith('left') || placement?.startsWith('right') ? (
          <polygon
            transform={`translate(${placement?.startsWith('right') ? 2 : 0}, 0)`}
            points={`
              -2,0
              ${size},0
              ${size / 2},${size * heightRatio + topOffset}
              ${size / 2 - 2},${size * heightRatio + topOffset}`}
            fill={border ? (theme[border] as string) : theme.tokens.border.primary}
          />
        ) : null}
        <polygon
          points={`0,0 ${size},0 ${size / 2},${size * heightRatio + topOffset}`}
          fill={border ? (theme[border] as string) : theme.tokens.border.primary}
        />
        <polygon
          points={`${offset},0 ${size - offset}, 0 ${size / 2},${size * heightRatio}`}
          fill={
            background ? (theme[background] as string) : theme.tokens.background.primary
          }
        />
      </svg>
    </ChonkWrap>
  );
}

const ChonkWrap = chonkStyled('div')<{
  size: number;
  placement?: PopperProps<any>['placement'];
}>`
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  position: absolute;
  transform-origin: center;

  ${p =>
    p.placement?.startsWith('top') && `top: 100%; left: 50%; transform: rotate(0deg);`}
  ${p => p.placement?.startsWith('bottom') && `bottom: 100%; left: 50%; transform: rotate(180deg);`}
  ${p => p.placement?.startsWith('left') && `left: 100%; top: 50%; transform: rotate(-90deg);`}
  ${p =>
    p.placement?.startsWith('right') &&
    `right: 100%; top: 50%; transform: rotate(90deg);`}

  > svg {
    width: ${p => p.size}px;
    height: ${p => p.size}px;
  }

`;

function LegacyOverlayArrow({size = 16, placement, ref, ...props}: OverlayArrowProps) {
  /**
   * SVG height
   */
  const h = Math.round(size * 0.4);
  /**
   * SVG width
   */
  const w = size;
  /**
   * SVG stroke width
   */
  const s = 1;
  const arrowPath = [
    `M 0 ${h - s / 2}`,
    `C ${w * 0.25} ${h - s / 2} ${w * 0.45} ${s / 2} ${w / 2} ${s / 2}`,
    `C ${w * 0.55} ${s / 2} ${w * 0.75} ${h - s / 2} ${w} ${h - s / 2}`,
  ].join('');

  const strokeMaskId = useId();
  const fillMaskId = useId();

  return (
    <Wrap ref={ref} placement={placement} size={size} {...props}>
      <SVG
        overflow="visible"
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        background="backgroundElevated"
        border="translucentBorder"
      >
        <defs>
          <mask id={strokeMaskId}>
            <rect x="0" y={-1} width="100%" height={h + 1 + 4} fill="white" />
          </mask>
          <mask id={fillMaskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <path d={arrowPath} vectorEffect="non-scaling-stroke" stroke="black" />
          </mask>
        </defs>

        <path
          d={`${arrowPath} V ${h} H 0 Z`}
          mask={`url(#${fillMaskId})`}
          className="fill"
        />
        <path d={arrowPath} mask={`url(#${strokeMaskId})`} className="stroke" />
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

const SVG = styled('svg')<{background: ColorOrAlias; border: ColorOrAlias}>`
  position: absolute;
  bottom: 50%;
  fill: none;
  stroke: none;

  path.stroke {
    stroke: ${p => p.theme[p.border]};
  }
  path.fill {
    fill: ${p => p.theme[p.background]};
  }
`;
