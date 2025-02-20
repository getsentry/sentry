import {Fragment} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {
  PRIMARY_SIDEBAR_WIDTH,
  SECONDARY_SIDEBAR_WIDTH,
} from 'sentry/components/nav/constants';
import {useNavContext} from 'sentry/components/nav/context';
import {PrimaryNavigationItems} from 'sentry/components/nav/primary/index';
import {SecondarySidebar} from 'sentry/components/nav/secondarySidebar';
import SidebarDropdown from 'sentry/components/sidebar/sidebarDropdown';
import {space} from 'sentry/styles/space';

type SidebarProps = {
  isHovered: boolean;
};

export function Sidebar({isHovered}: SidebarProps) {
  const {isCollapsed, isDragging} = useNavContext();

  return (
    <Fragment>
      <SidebarWrapper role="navigation" aria-label="Primary Navigation">
        <SidebarHeader>
          <SidebarDropdown orientation="left" collapsed />
        </SidebarHeader>
        <PrimaryNavigationItems />
      </SidebarWrapper>
      {isCollapsed ? null : <SecondarySidebar />}

      {isCollapsed || isDragging ? (
        <CollapsedSecondaryWrapper
          initial="hidden"
          animate={isHovered || isDragging ? 'visible' : 'hidden'}
          variants={{
            visible: {x: 0},
            hidden: {x: -SECONDARY_SIDEBAR_WIDTH - 10},
          }}
          transition={{duration: 0.3}}
          data-test-id="collapsed-secondary-sidebar"
          data-visible={isHovered || isDragging}
        >
          <SecondarySidebar />
        </CollapsedSecondaryWrapper>
      ) : null}
    </Fragment>
  );
}

const SidebarWrapper = styled('div')`
  width: ${PRIMARY_SIDEBAR_WIDTH}px;
  padding: ${space(2)} 0 ${space(1)} 0;
  border-right: 1px solid ${p => p.theme.translucentGray200};
  background: ${p => p.theme.surface300};
  display: flex;
  flex-direction: column;
  z-index: ${p => p.theme.zIndex.sidebar};
`;

const CollapsedSecondaryWrapper = styled(motion.div)`
  position: absolute;
  top: 0;
  left: ${PRIMARY_SIDEBAR_WIDTH}px;
  height: 100%;
`;

const SidebarHeader = styled('header')`
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: ${space(1.5)};
`;
