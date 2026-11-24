import type {ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

interface SetupCardFrameProps {
  children: ReactNode;
}

export function SetupCardFrame({children}: SetupCardFrameProps) {
  const theme = useTheme();

  return (
    <Container
      background={theme.type === 'dark' ? 'secondary' : 'primary'}
      radius="2xl"
      padding="2xl 2xl xl"
      width="100%"
      overflow="hidden"
    >
      {surfaceProps => <ChonkySurface {...surfaceProps}>{children}</ChonkySurface>}
    </Container>
  );
}

/** An embossed slab: the neutral button chonk, thicker along the bottom edge. */
const ChonkySurface = styled('div')`
  border: 1px solid ${p => p.theme.tokens.interactive.chonky.embossed.neutral.chonk};
  border-bottom-width: 4px;
`;
