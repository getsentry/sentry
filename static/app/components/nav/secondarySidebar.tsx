import styled from '@emotion/styled';

import {SECONDARY_SIDEBAR_WIDTH} from 'sentry/components/nav/constants';
import {useNavContext} from 'sentry/components/nav/context';

export function SecondarySidebar() {
  const {setSecondaryNavEl} = useNavContext();

  return (
    <SecondarySidebarWrapper
      ref={setSecondaryNavEl}
      role="navigation"
      aria-label="Secondary Navigation"
    />
  );
}

const SecondarySidebarWrapper = styled('div')`
  position: relative;
  border-right: 1px solid ${p => p.theme.translucentGray200};
  background: ${p => p.theme.surface300};
  display: grid;
  grid-template-rows: auto 1fr auto;
  width: ${SECONDARY_SIDEBAR_WIDTH}px;
  z-index: ${p => p.theme.zIndex.sidebarPanel};
  height: 100%;
`;
