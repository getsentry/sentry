import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {DrawerBody} from 'sentry/components/globalDrawer/components';

interface SeerDrawerBody {
  children: ReactNode;
}

export function SeerDrawerBody({children}: SeerDrawerBody) {
  return <StyledDrawerBody>{children}</StyledDrawerBody>;
}

const StyledDrawerBody = styled(DrawerBody)`
  overflow-y: scroll;
`;
