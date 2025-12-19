import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {DemoTourStep, SharedTourElement} from 'sentry/utils/demoMode/demoTours';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {
  IssueDetailsTour,
  IssueDetailsTourContext,
} from 'sentry/views/issueDetails/issueDetailsTour';
import {
  IssueDetailsContextProvider,
  useIssueDetails,
} from 'sentry/views/issueDetails/streamline/context';
import {EventDetailsHeader} from 'sentry/views/issueDetails/streamline/eventDetailsHeader';
import {IssueEventNavigation} from 'sentry/views/issueDetails/streamline/eventNavigation';
import StreamlinedGroupHeader from 'sentry/views/issueDetails/streamline/header/header';
import StreamlinedSidebar from 'sentry/views/issueDetails/streamline/sidebar/sidebar';
import {ToggleSidebar} from 'sentry/views/issueDetails/streamline/sidebar/toggleSidebar';
import {
  getGroupReprocessingStatus,
  ReprocessingStatus,
} from 'sentry/views/issueDetails/utils';

function GroupLayoutBody({children}: {children: React.ReactNode}) {
  const {isSidebarOpen} = useIssueDetails();
  return (
    <StyledLayoutBody data-test-id="group-event-details" sidebarOpen={isSidebarOpen}>
      {children}
    </StyledLayoutBody>
  );
}

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
  const issueTypeConfig = getConfigForIssueType(group, group.project);
  const hasFilterBar = issueTypeConfig.header.filterBar.enabled;
  const groupReprocessingStatus = getGroupReprocessingStatus(group);

  return (
    <IssueDetailsContextProvider>
      <StreamlinedGroupHeader group={group} event={event ?? null} project={project} />
      <GroupLayoutBody>
        <div>
          <SharedTourElement<IssueDetailsTour>
            id={IssueDetailsTour.AGGREGATES}
            demoTourId={DemoTourStep.ISSUES_AGGREGATES}
            tourContext={IssueDetailsTourContext}
            title={t('View data in aggregate')}
            description={t(
              'The top section of the page always displays data in aggregate, including trends over time or tag value distributions.'
            )}
            position="bottom"
          >
            <EventDetailsHeader event={event} group={group} project={project} />
          </SharedTourElement>
          <SharedTourElement<IssueDetailsTour>
            id={IssueDetailsTour.EVENT_DETAILS}
            demoTourId={DemoTourStep.ISSUES_EVENT_DETAILS}
            tourContext={IssueDetailsTourContext}
            title={t('Explore details')}
            description={t(
              'Here we capture everything we know about this data example, like context, trace, breadcrumbs, replay, and tags.'
            )}
            position="top"
          >
            <GroupContent>
              {groupReprocessingStatus !== ReprocessingStatus.REPROCESSING && (
                <NavigationSidebarWrapper hasToggleSidebar={!hasFilterBar}>
                  <IssueEventNavigation event={event} group={group} />
                  {/* Since the event details header is disabled, display the sidebar toggle here */}
                  {!hasFilterBar && <ToggleSidebar size="sm" />}
                </NavigationSidebarWrapper>
              )}
              <ContentPadding>{children}</ContentPadding>
            </GroupContent>
          </SharedTourElement>
        </div>
        <StreamlinedSidebar group={group} event={event} project={project} />
      </GroupLayoutBody>
    </IssueDetailsContextProvider>
  );
}

const StyledLayoutBody = styled('div')<{
  sidebarOpen: boolean;
}>`
  display: grid;
  background-color: ${p => p.theme.tokens.background.primary};
  grid-template-columns: ${p => (p.sidebarOpen ? 'minmax(100px, 100%) 325px' : '100%')};

  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    display: flex;
    flex-grow: 1;
    flex-direction: column;
  }
`;

const GroupContent = styled('section')`
  background: ${p => p.theme.backgroundSecondary};
  display: flex;
  flex-direction: column;
  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    border-right: 1px solid ${p => p.theme.tokens.border.primary};
  }
  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    border-bottom-width: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const NavigationSidebarWrapper = styled('div')<{
  hasToggleSidebar: boolean;
}>`
  position: relative;
  display: flex;
  gap: ${space(0.5)};
  padding: ${p =>
    p.hasToggleSidebar
      ? `${p.theme.space.md} 0 ${p.theme.space.sm} ${p.theme.space['2xl']}`
      : `${p.theme.space.sm} ${p.theme.space['2xl']} ${p.theme.space.xs} ${p.theme.space['2xl']}`};
`;

const ContentPadding = styled('div')`
  min-height: 100vh;
  padding: 0 ${p => p.theme.space['2xl']} ${p => p.theme.space['2xl']}
    ${p => p.theme.space['2xl']};
`;
