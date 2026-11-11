import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

export function LayeredContainer({children}: {children: ReactNode}) {
  return (
    <Container width="100%" position="relative" radius="xl">
      {frameProps => (
        <LayeredFrame {...frameProps}>
          <Container
            background="primary"
            border="accent"
            radius="xl"
            position="relative"
            width="100%"
          >
            {surfaceProps => (
              <LayeredSurface {...surfaceProps}>{children}</LayeredSurface>
            )}
          </Container>
        </LayeredFrame>
      )}
    </Container>
  );
}

const LayeredFrame = styled('div')`
  isolation: isolate;

  &::before,
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }

  &::before {
    z-index: 0;
    transform: translateY(18px);
    background: ${p => p.theme.colors.red400};
  }

  &::after {
    z-index: 1;
    transform: translateY(12px);
    background: ${p => p.theme.colors.pink600};
  }
`;

const LayeredSurface = styled('div')`
  z-index: 2;
  box-shadow: 0 6px 0 ${p => p.theme.colors.blue600};
`;
