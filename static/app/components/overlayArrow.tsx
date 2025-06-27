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

function ChonkOverlayArrow({placement, ref}: OverlayArrowProps) {
  const theme = useTheme();
  const fill = theme.tokens.background.primary;
  const stroke = theme.tokens.border.primary;
  const arrowProps = {fill, stroke};

  return (
    <ChonkWrap size={20} ref={ref} placement={placement}>
      {placement?.startsWith('top') && <ArrowBottom {...arrowProps} />}
      {placement?.startsWith('bottom') && <ArrowTop {...arrowProps} />}
      {(placement?.startsWith('right') || placement?.startsWith('left')) && (
        <ArrowLeft {...arrowProps} />
      )}
    </ChonkWrap>
  );
}

function ArrowBottom({stroke, fill}: {fill: string; stroke: string}) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 6">
      <path fill={stroke} d="M12.2 5a4 4 0 0 1-4.4 0L.4 0h19.2l-7.4 5Z" />
      <path fill={fill} d="M11.1 3.3a2 2 0 0 1-2.2 0L4 0h12l-4.9 3.3Z" />
    </svg>
  );
}

function ArrowTop({stroke, fill}: {fill: string; stroke: string}) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 5">
      <path fill={stroke} d="M12.2 1a4 4 0 0 0-4.4 0L1.9 5h16.2l-5.9-4Z" />
      <path fill={fill} d="M11.1 1.7a2 2 0 0 0-2.2 0L4 5h12l-4.9-3.3Z" />
    </svg>
  );
}

function ArrowLeft({stroke, fill}: {fill: string; stroke: string}) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 6 18">
      <path fill={stroke} d="M5.4 17.2 1 10.8a4.4 4.4 0 0 1 0-4.4L5.4 0v17.2Z" />
      <path fill={fill} d="M2 7.5a2 2 0 0 0 0 2.1l3.4 4.7V2.9L2 7.5Z" />
    </svg>
  );
}

const ChonkWrap = chonkStyled('div')<{
  size: number;
  placement?: PopperProps<any>['placement'];
}>`
  position: relative;
  display: flex;

  > svg {
    position: absolute;
    bottom: 50%;
    width: 20px;
  }

  ${p =>
    p.placement?.startsWith('top') &&
    `bottom: 0; transform: translateY(50%) rotate(90deg);`}
  ${p => p.placement?.startsWith('bottom') && `top: 0; transform: translateY(-50%) ;`}
  ${p => p.placement?.startsWith('left') && `right: 0; transform: translateX(50%);`}
  ${p =>
    p.placement?.startsWith('right') &&
    `left: 0; transform: translateX(-50%) rotate(-90deg);`}
`;

function LegacyOverlayArrow({
  size = 16,
  strokeWidth = 1,
  placement,
  background = 'backgroundElevated',
  border = 'translucentBorder',
  ref,
  ...props
}: OverlayArrowProps) {
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

  const strokeMaskId = useId();
  const fillMaskId = useId();

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
            <rect
              x="0"
              y={-strokeWidth}
              width="100%"
              height={h + strokeWidth + 4}
              fill="white"
            />
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
