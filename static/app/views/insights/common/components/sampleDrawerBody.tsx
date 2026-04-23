import styled from '@emotion/styled';

import {DrawerBody} from '@sentry/scraps/drawer';

export const SampleDrawerBody = styled(DrawerBody)`
  flex-grow: 1;
  overflow: auto;
  overscroll-behavior: contain;
  /* Move the scrollbar to the left edge */
  scroll-margin: 0 ${p => p.theme.space.xl};
  direction: rtl;
  * {
    direction: ltr;
  }
`;
