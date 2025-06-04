import styled from '@emotion/styled';

import {DrawerBody} from 'sentry/components/globalDrawer/components';
import {space} from 'sentry/styles/space';

export const SampleDrawerBody = styled(DrawerBody)`
  flex-grow: 1;
  overflow: auto;
  overscroll-behavior: contain;
  /* Move the scrollbar to the left edge */
  scroll-margin: 0 ${space(2)};
  direction: rtl;
  * {
    direction: ltr;
  }
`;
