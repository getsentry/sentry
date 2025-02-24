import styled from '@emotion/styled';

import {useNavContext} from 'sentry/components/nav/context';
import MobileTopbar from 'sentry/components/nav/mobileTopbar';
import {Sidebar} from 'sentry/components/nav/sidebar';
import {NavLayout} from 'sentry/components/nav/types';

function Nav() {
  const {layout, navParentRef} = useNavContext();

  return (
    <NavContainer ref={navParentRef}>
      {layout === NavLayout.SIDEBAR ? <Sidebar /> : <MobileTopbar />}
    </NavContainer>
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
