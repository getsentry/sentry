import styled from '@emotion/styled';

import {FluidHeight} from 'sentry/views/explore/replays/detail/layout/fluidHeight';

export const GridTable = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
`;
