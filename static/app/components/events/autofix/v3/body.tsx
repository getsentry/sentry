import type {ReactNode, RefObject, UIEventHandler} from 'react';
import styled from '@emotion/styled';

import {DrawerBody} from '@sentry/scraps/drawer';

interface SeerDrawerBody {
  children: ReactNode;
  onScroll?: UIEventHandler;
  ref?: RefObject<HTMLDivElement | null>;
}

export function SeerDrawerBody({children, onScroll, ref}: SeerDrawerBody) {
  return (
    <StyledDrawerBody ref={ref} onScroll={onScroll}>
      {children}
    </StyledDrawerBody>
  );
}

const StyledDrawerBody = styled(DrawerBody)`
  overflow-y: scroll;
`;
