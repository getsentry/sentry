import styled from '@emotion/styled';

import space from 'app/styles/space';

const GridCell = styled('div')<{
  hasError?: boolean;
  isLastItem?: boolean;
}>`
  position: relative;
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
    `
      background: #fffcfb;
      border-top: 1px solid #fa4747;
      border-bottom: 1px solid #fa4747;
      z-index: 1;
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
    background: ${p => (p.hasError ? '#fa4747' : p.theme.borderLight)};
    position: absolute;
    @media (min-width: ${p => p.theme.breakpoints[0]}) {
      left: 29px;
    }
  }
`;

const Grid = styled('div')<{maxHeight?: React.CSSProperties['maxHeight']}>`
  border: 1px solid ${p => p.theme.borderDark};
  display: grid;
  overflow-y: auto;
  ${p => p.maxHeight && `max-height: ${p.maxHeight}`};
  > *:nth-last-child(5):before {
    bottom: calc(100% - ${space(1)});
  }
  grid-template-columns: 45px 55px 1fr 76px 65px;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 65px 132px 1fr 94px 84px;
  }
`;

export {Grid, GridCell, GridCellLeft};
