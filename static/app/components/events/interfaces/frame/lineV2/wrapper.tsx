import styled from '@emotion/styled';

import space from 'app/styles/space';

const Wrapper = styled('div')<{
  haveFramesAtLeastOneGroupingBadge?: boolean;
  haveFramesAtLeastOneExpandedFrame?: boolean;
}>`
  display: grid;
  grid-template-columns: ${p =>
    p.haveFramesAtLeastOneGroupingBadge && p.haveFramesAtLeastOneExpandedFrame
      ? '1.5fr 16px'
      : p.haveFramesAtLeastOneGroupingBadge
      ? '1fr 0.5fr'
      : p.haveFramesAtLeastOneExpandedFrame
      ? '1fr 16px'
      : '1fr'};
  grid-gap: ${space(1)};
  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    align-items: center;
    ${p =>
      p.haveFramesAtLeastOneGroupingBadge &&
      p.haveFramesAtLeastOneExpandedFrame &&
      `grid-template-columns: 1.5fr 0.5fr 16px`};
  }
`;

export default Wrapper;
