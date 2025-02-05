import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

export const OverflowFluidHeight = styled(FluidHeight)`
  overflow: auto;
`;
export const SectionList = styled('dl')`
  margin: 0;
`;
export const ParseError = styled('p')`
  padding: ${space(2)};
`;
