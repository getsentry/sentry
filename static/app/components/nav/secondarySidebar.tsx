import styled from '@emotion/styled';

import {useNavContext} from 'sentry/components/nav/context';

export function SecondarySidebar() {
  const {setSecondaryNavEl} = useNavContext();

  return <SecondarySidebarWrapper ref={setSecondaryNavEl} />;
}

const SecondarySidebarWrapper = styled('div')`
  position: relative;
  border-right: 1px solid ${p => p.theme.translucentGray200};
  background: ${p => p.theme.surface300};
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  flex-direction: column;
  width: 190px;
  z-index: ${p => p.theme.zIndex.sidebarPanel};
  height: 100%;
`;
