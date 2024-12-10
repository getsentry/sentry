import styled from '@emotion/styled';

import {NavContextProvider} from 'sentry/components/nav/context';
import MobileTopbar from 'sentry/components/nav/mobileTopbar';
import Sidebar from 'sentry/components/nav/sidebar';
import {useBreakpoints} from 'sentry/utils/metrics/useBreakpoints';

function Nav() {
  const screen = useBreakpoints();

  return (
    <NavContextProvider>
      <NavContainer>{screen.medium ? <Sidebar /> : <MobileTopbar />}</NavContainer>
    </NavContextProvider>
  );
}

const NavContainer = styled('div')`
  display: flex;
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.sidebarPanel};
  user-select: none;

  @media screen and (min-width: ${p => p.theme.breakpoints.medium}) {
    bottom: 0;
    height: 100vh;
    height: 100dvh;
  }
`;

export default Nav;
