import {forwardRef, useMemo} from 'react';
import {PopperProps} from 'react-popper';
import styled from '@emotion/styled';

import domId from 'sentry/utils/domId';
import {ColorOrAlias} from 'sentry/utils/theme';

interface OverlayArrowProps extends React.ComponentPropsWithRef<'div'> {
  background?: ColorOrAlias;
  border?: ColorOrAlias;
  placement?: PopperProps<any>['placement'];
  size?: number;
  strokeWidth?: number;
}

function BaseOverlayArrow(
  {
    size = 16,
    strokeWidth = 1,
    placement,
    background = 'backgroundElevated',
    border = 'translucentBorder',
    ...props
  }: OverlayArrowProps,
  ref: React.Ref<HTMLDivElement>
) {
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
  const s = strokeWidth;
  const arrowPath = [
    `M 0 ${h - s / 2}`,
    `C ${w * 0.25} ${h - s / 2} ${w * 0.45} ${s / 2} ${w / 2} ${s / 2}`,
    `C ${w * 0.55} ${s / 2} ${w * 0.75} ${h - s / 2} ${w} ${h - s / 2}`,
  ].join('');

  const strokeMaskId = useMemo(() => domId('stroke-mask'), []);
  const fillMaskId = useMemo(() => domId('fill-mask'), []);

  return (
    <Wrap ref={ref} placement={placement} size={size} {...props}>
      <SVG
        overflow="visible"
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        background={background}
        border={border}
      >
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
          d={`${arrowPath} V ${h} H 0 Z`}
          mask={`url(#${fillMaskId})`}
          className="fill"
        />
        <path d={arrowPath} mask={`url(#${strokeMaskId})`} className="stroke" />
      </SVG>
    </Wrap>
  );
}

const OverlayArrow = forwardRef(BaseOverlayArrow);

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

export {OverlayArrow, OverlayArrowProps};
