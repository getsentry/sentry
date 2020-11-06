import styled from '@emotion/styled';
import {css} from '@emotion/core';

import theme, {Color} from 'app/utils/theme';
import space from 'app/styles/space';

const IconWrapper = styled('div', {
  shouldForwardProp: prop => prop !== 'color',
})<{
  color?: Color | React.CSSProperties['color'];
  size?: number;
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: ${p => p.theme.white};
  box-shadow: ${p => p.theme.dropShadowLightest};
  border-radius: 32px;
  z-index: ${p => p.theme.zIndex.breadcrumbs.iconWrapper};
  position: relative;
  border: 1px solid ${p => p.theme.border};
  color: ${p => p.theme.gray800};
  ${p =>
    p.color &&
    `
      color: ${p.theme[p.color] || p.color};
      border-color: ${p.theme[p.color] || p.color};
    `}
`;

const GridCell = styled('div')<{
  hasError?: boolean;
  isLastItem?: boolean;
}>`
  height: 100%;
  position: relative;
  white-space: pre-wrap;
  word-break: break-all;
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  padding: ${space(1)};
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding: ${space(1)} ${space(2)};
  }
  ${p =>
    p.hasError &&
    `
      background: #fffcfb;
      border-bottom: 1px solid ${p.theme.red300};
      :after {
        content: '';
        position: absolute;
        top: -1px;
        left: 0;
        height: 1px;
        width: 100%;
        background: ${p.theme.red300};
      }
    `}
  ${p => p.isLastItem && `border-bottom: none`};
`;

const GridCellLeft = styled(GridCell)`
  align-items: center;
  line-height: 1;
  padding: ${space(1)} ${space(0.5)} ${space(1)} ${space(1)};
  :before {
    content: '';
    display: block;
    width: 1px;
    top: 0;
    bottom: 0;
    left: 21px;
    background: ${p => (p.hasError ? p.theme.red300 : p.theme.gray300)};
    position: absolute;
    @media (min-width: ${p => p.theme.breakpoints[0]}) {
      left: 29px;
    }
  }
`;

const aroundContentStyle = css`
  border: 1px solid ${theme.border};
  border-radius: ${theme.borderRadius};
  box-shadow: ${theme.dropShadowLightest};
  z-index: 1;
`;

export {GridCell, GridCellLeft, IconWrapper, aroundContentStyle};
