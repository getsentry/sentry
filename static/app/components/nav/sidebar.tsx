import {Fragment} from 'react';
import styled from '@emotion/styled';

import {PrimaryNavigationItems} from 'sentry/components/nav/primary';
import Submenu from 'sentry/components/nav/submenu';
import SidebarDropdown from 'sentry/components/sidebar/sidebarDropdown';
import {space} from 'sentry/styles/space';

export function Sidebar() {
  return (
    <Fragment>
      <SidebarWrapper role="navigation" aria-label="Primary Navigation">
        <SidebarHeader>
          <SidebarDropdown orientation="left" collapsed />
        </SidebarHeader>
        <PrimaryNavigationItems />
      </SidebarWrapper>
      <Submenu />
    </Fragment>
  );
}

const SidebarWrapper = styled('div')`
  height: 40px;
  width: 100vw;
  padding: ${space(2)} 0;
  border-right: 1px solid ${p => p.theme.translucentGray100};
  background: #3e2648;
  background: linear-gradient(180deg, #3e2648 0%, #442c4e 100%);
  display: flex;
  flex-direction: column;
  z-index: ${p => p.theme.zIndex.sidebar};

  @media screen and (min-width: ${p => p.theme.breakpoints.medium}) {
    height: unset;
    width: 74px;
  }
`;

const SidebarHeader = styled('header')`
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: ${space(1.5)};
`;
