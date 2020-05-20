import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {Color} from 'app/utils/theme';
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
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  border-radius: 32px;
  z-index: 1;
  position: relative;
  border: 1px solid ${p => p.theme.gray2};
  ${p =>
    p.color &&
    css`
      color: ${p.theme[p.color] || p.color};
      border-color: ${p.theme[p.color] || p.color};
    `}
`;

const GridCell = styled('div')<{
  hasError?: boolean;
  isLastItem?: boolean;
}>`
  position: relative;
  line-height: 26px;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  margin-bottom: -1px;
  text-overflow: ellipsis;
  overflow: hidden;
  padding: ${space(1)};
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding: ${space(1)} ${space(2)};
  }
  ${p =>
    p.hasError &&
    css`
      background: #fffcfb;
      border-top: 1px solid #fa4747;
      border-bottom: 1px solid #fa4747;
      z-index: 1;
      ${p.isLastItem && 'margin-bottom: 0'};
    `}
`;

const GridCellLeft = styled(GridCell)`
  position: relative;
  :before {
    content: '';
    display: block;
    width: 1px;
    top: 0;
    bottom: 0;
    left: 21px;
    background: ${p => (p.hasError ? '#fa4747' : p.theme.borderLight)};
    position: absolute;
    @media (min-width: ${p => p.theme.breakpoints[0]}) {
      left: 29px;
    }
  }
`;

const Grid = styled('div')<{maxHeight?: React.CSSProperties['maxHeight']}>`
  display: grid;
  overflow-y: auto;
  ${p => p.maxHeight && `max-height: ${p.maxHeight}`};
  > *:nth-last-child(5):before {
    bottom: calc(100% - ${space(1)});
  }
  grid-template-columns: max-content 55px 1fr 76px 80px;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: max-content 110px 1fr 76px 80px;
  }
`;

export {Grid, GridCell, GridCellLeft, IconWrapper};
