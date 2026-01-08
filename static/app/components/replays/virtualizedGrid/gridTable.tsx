import styled from '@emotion/styled';

import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

export const GridTable = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};

  .beforeHoverTime + .afterHoverTime:before {
    border-top: 1px solid ${p => p.theme.colors.blue200};
    content: '';
    left: 0;
    position: absolute;
    top: 0;
    width: 999999999%;
  }

  .beforeHoverTime:last-child:before {
    border-bottom: 1px solid ${p => p.theme.colors.blue200};
    content: '';
    right: 0;
    position: absolute;
    bottom: 0;
    width: 999999999%;
  }

  .beforeCurrentTime + .afterCurrentTime:before {
    border-top: 1px solid ${p => p.theme.colors.blue400};
    content: '';
    left: 0;
    position: absolute;
    top: 0;
    width: 999999999%;
  }

  .beforeCurrentTime:last-child:before {
    border-bottom: 1px solid ${p => p.theme.colors.blue400};
    content: '';
    right: 0;
    position: absolute;
    bottom: 0;
    width: 999999999%;
  }
`;
