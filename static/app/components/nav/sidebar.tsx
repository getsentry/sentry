import {Fragment} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {SECONDARY_SIDEBAR_WIDTH} from 'sentry/components/nav/constants';
import {useNavContext} from 'sentry/components/nav/context';
import {PrimaryNavigationItems} from 'sentry/components/nav/primary';
import {SecondarySidebar} from 'sentry/components/nav/secondarySidebar';
import SidebarDropdown from 'sentry/components/sidebar/sidebarDropdown';
import {space} from 'sentry/styles/space';

type SidebarProps = {
  isHovered: boolean;
};

export function Sidebar({isHovered}: SidebarProps) {
  const {isCollapsed} = useNavContext();

  return (
    <Fragment>
      <SidebarWrapper role="navigation" aria-label="Primary Navigation">
        <SidebarHeader>
          <SidebarDropdown orientation="left" collapsed />
        </SidebarHeader>
        <PrimaryNavigationItems />
      </SidebarWrapper>
      {isCollapsed ? null : <SecondarySidebar />}

      {isCollapsed ? (
        <CollapsedSecondaryWrapper
          initial="hidden"
          animate={isHovered ? 'visible' : 'hidden'}
          variants={{
            visible: {x: 0},
            hidden: {x: -SECONDARY_SIDEBAR_WIDTH - 10},
          }}
          transition={{duration: 0.3}}
          data-test-id="collapsed-secondary-sidebar"
          data-visible={isHovered}
        >
          <SecondarySidebar />
        </CollapsedSecondaryWrapper>
      ) : null}
    </Fragment>
  );
}

const SidebarWrapper = styled('div')`
  width: 74px;
  padding: ${space(2)} 0;
  border-right: 1px solid ${p => p.theme.translucentGray100};
  background: #3e2648;
  background: linear-gradient(180deg, #3e2648 0%, #442c4e 100%);
  display: flex;
  flex-direction: column;
  z-index: ${p => p.theme.zIndex.sidebar};
`;

const CollapsedSecondaryWrapper = styled(motion.div)`
  position: absolute;
  top: 0;
  left: 74px;
  height: 100%;
`;

const SidebarHeader = styled('header')`
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: ${space(1.5)};
`;
