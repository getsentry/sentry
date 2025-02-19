import {useCallback, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import useMedia from 'sentry/utils/useMedia';
import {
  IssueDetailsContext,
  useIssueDetailsReducer,
} from 'sentry/views/issueDetails/streamline/context';
import {EventDetailsHeader} from 'sentry/views/issueDetails/streamline/eventDetailsHeader';
import {IssueEventNavigation} from 'sentry/views/issueDetails/streamline/eventNavigation';
import StreamlinedGroupHeader from 'sentry/views/issueDetails/streamline/header/header';
import StreamlinedSidebar from 'sentry/views/issueDetails/streamline/sidebar/sidebar';
import {ToggleSidebar} from 'sentry/views/issueDetails/streamline/sidebar/toggleSidebar';
import {getGroupReprocessingStatus} from 'sentry/views/issueDetails/utils';

interface GroupDetailsLayoutProps {
  children: React.ReactNode;
  event: Event | undefined;
  group: Group;
  project: Project;
}

export function GroupDetailsLayout({
  group,
  event,
  project,
  children,
}: GroupDetailsLayoutProps) {
  const theme = useTheme();
  const {issueDetails, dispatch} = useIssueDetailsReducer();
  const isScreenSmall = useMedia(`(max-width: ${theme.breakpoints.large})`);
  const shouldDisplaySidebar = issueDetails.isSidebarOpen || isScreenSmall;
  const issueTypeConfig = getConfigForIssueType(group, group.project);
  const groupReprocessingStatus = getGroupReprocessingStatus(group);
  const [sidebarWidth, setSidebarWidth] = useState(325);

  const handleDrag = useCallback((event: MouseEvent) => {
    const windowWidth = window.innerWidth;
    const newWidth = Math.max(200, Math.min(800, windowWidth - event.clientX));
    setSidebarWidth(newWidth);
  }, []);

  const handleDragStart = useCallback(() => {
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);
  }, [handleDrag]);

  const handleDragEnd = useCallback(() => {
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', handleDragEnd);
  }, [handleDrag]);

  const hasFilterBar = issueTypeConfig.header.filterBar.enabled;

  return (
    <IssueDetailsContext.Provider value={{...issueDetails, dispatch}}>
      <StreamlinedGroupHeader
        group={group}
        event={event ?? null}
        project={project}
        groupReprocessingStatus={groupReprocessingStatus}
      />
      <StyledLayoutBody
        data-test-id="group-event-details"
        sidebarOpen={issueDetails.isSidebarOpen}
        sidebarWidth={sidebarWidth}
      >
        <div>
          <EventDetailsHeader event={event} group={group} project={project} />
          <GroupContent>
            <NavigationSidebarWrapper hasToggleSidebar={!hasFilterBar}>
              <IssueEventNavigation event={event} group={group} />
              {!hasFilterBar && <ToggleSidebar size="sm" />}
            </NavigationSidebarWrapper>
            <ContentPadding>{children}</ContentPadding>
          </GroupContent>
        </div>
        {shouldDisplaySidebar ? (
          <SidebarContainer>
            <DragHandle onMouseDown={handleDragStart} />
            <StreamlinedSidebar group={group} event={event} project={project} />
          </SidebarContainer>
        ) : null}
      </StyledLayoutBody>
    </IssueDetailsContext.Provider>
  );
}

const StyledLayoutBody = styled(Layout.Body)<{
  sidebarOpen: boolean;
  sidebarWidth: number;
}>`
  padding: 0 !important;
  gap: 0 !important;
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    align-content: stretch;
    grid-template-columns: minmax(100px, auto) ${p =>
        p.sidebarOpen ? `${p.sidebarWidth}px` : '0px'};
  }
`;

const GroupContent = styled('section')`
  background: ${p => p.theme.backgroundSecondary};
  display: flex;
  flex-direction: column;
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    border-right: 1px solid ${p => p.theme.translucentBorder};
  }
  @media (max-width: ${p => p.theme.breakpoints.large}) {
    border-bottom-width: 1px solid ${p => p.theme.translucentBorder};
  }
`;

const NavigationSidebarWrapper = styled('div')<{
  hasToggleSidebar: boolean;
}>`
  position: relative;
  display: flex;
  padding: ${p =>
    p.hasToggleSidebar
      ? `${space(1)} 0 ${space(0.5)} ${space(1.5)}`
      : `10px ${space(1.5)} ${space(0.25)} ${space(1.5)}`};
`;

const ContentPadding = styled('div')`
  min-height: 100vh;
  padding: 0 ${space(1.5)} ${space(1.5)} ${space(1.5)};
`;

const SidebarContainer = styled('div')`
  position: relative;
  height: 100%;

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    border-left: 1px solid ${p => p.theme.border};
  }
`;

const DragHandle = styled('div')`
  position: absolute;
  left: -2px;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.2s ease;
  z-index: ${p => p.theme.zIndex.initial + 1};

  &:hover {
    background: ${p => p.theme.border};
  }

  &:active {
    background: ${p => p.theme.active};
  }

  @media (max-width: ${p => p.theme.breakpoints.large}) {
    display: none;
  }
`;
