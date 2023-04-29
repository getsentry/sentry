import styled from '@emotion/styled';

const FluidHeight = styled('div')<{overflow?: 'hidden' | 'auto' | 'scroll'}>`
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  flex-grow: 1;
  overflow: ${p => p.overflow ?? 'hidden'};
  height: 100%;
`;

export default FluidHeight;
