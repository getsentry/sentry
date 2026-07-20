import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {DemoTourStep, SharedTourElement} from 'sentry/utils/demoMode/demoTours';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  IssueDetailsContextProvider,
  useIssueDetails,
} from 'sentry/views/issueDetails/context';
import {EventDetailsHeader} from 'sentry/views/issueDetails/eventDetailsHeader';
import {IssueEventNavigation} from 'sentry/views/issueDetails/eventNavigation';
import {GroupHeader} from 'sentry/views/issueDetails/header/header';
import {
  IssueDetailsTour,
  IssueDetailsTourContext,
} from 'sentry/views/issueDetails/issueDetailsTour';
import {SampleEventAlert} from 'sentry/views/issueDetails/sampleEventAlert';
import {IssueDetailsSidebar} from 'sentry/views/issueDetails/sidebar/sidebar';
import {ToggleSidebar} from 'sentry/views/issueDetails/sidebar/toggleSidebar';
import {useIsSampleEvent} from 'sentry/views/issueDetails/utils';
import {
  getGroupReprocessingStatus,
  ReprocessingStatus,
} from 'sentry/views/issueDetails/utils';

function GroupLayoutBody({children}: {children: React.ReactNode}) {
  const {isSidebarOpen} = useIssueDetails();
  return (
    <Container
      data-test-id="group-event-details"
      background="primary"
      display={{'2xs': 'flex', lg: 'grid'}}
      flexGrow={{'2xs': 1, lg: 0}}
      style={{
        flexDirection: 'column',
        gridTemplateColumns: isSidebarOpen ? 'minmax(100px, 100%) 325px' : '100%',
      }}
    >
      {children}
    </Container>
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
  const theme = useTheme();
  const organization = useOrganization();
  const isSampleError = useIsSampleEvent();

  return (
    <IssueDetailsContextProvider>
      {isSampleError && (
        <SampleEventAlert project={group.project} organization={organization} />
      )}
      <Container
        display="contents"
        style={{'--issue-details-inset': theme.space.xl} as React.CSSProperties}
      >
        <GroupHeader group={group} event={event ?? null} project={project} />
        <GroupLayoutBody>
          <div>
            <SharedTourElement<IssueDetailsTour>
              id={IssueDetailsTour.AGGREGATES}
              demoTourId={DemoTourStep.ISSUES_AGGREGATES}
              tourContext={IssueDetailsTourContext}
              title={t('See overall impact')}
              description={t(
                "Here you'll see aggregate metrics like frequency over time, total affected users, and where it occurs (environment, release, device, etc.)."
              )}
              position="bottom"
            >
              {tourProps => (
                <div {...tourProps}>
                  <EventDetailsHeader event={event} group={group} project={project} />
                </div>
              )}
            </SharedTourElement>
            <SharedTourElement<IssueDetailsTour>
              id={IssueDetailsTour.EVENT_DETAILS}
              demoTourId={DemoTourStep.ISSUES_EVENT_DETAILS}
              tourContext={IssueDetailsTourContext}
              title={t('Investigate the issue')}
              description={t(
                'See all the issue context including the stack trace, tags, screenshots and connected replays, logs, and traces.'
              )}
              position="top"
            >
              {tourProps => (
                <div {...tourProps}>
                  <Stack
                    as="section"
                    background="secondary"
                    borderRight={{'2xs': 'none', lg: 'primary'}}
                    borderBottom={{'2xs': 'primary', lg: 'none'}}
                  >
                    {groupReprocessingStatus !== ReprocessingStatus.REPROCESSING &&
                      issueTypeConfig.header.eventNavigation.enabled && (
                        <NavigationSidebarWrapper hasToggleSidebar={!hasFilterBar}>
                          <IssueEventNavigation event={event} group={group} />
                          {/* Since the event details header is disabled, display the sidebar toggle here */}
                          {!hasFilterBar && <ToggleSidebar size="sm" />}
                        </NavigationSidebarWrapper>
                      )}
                    <ContentPadding>{children}</ContentPadding>
                  </Stack>
                </div>
              )}
            </SharedTourElement>
          </div>
          <IssueDetailsSidebar group={group} event={event} project={project} />
        </GroupLayoutBody>
      </Container>
    </IssueDetailsContextProvider>
  );
}

const NavigationSidebarWrapper = styled('div')<{
  hasToggleSidebar: boolean;
}>`
  position: relative;
  display: flex;
  gap: ${p => p.theme.space.xs};
  padding: ${p =>
    p.hasToggleSidebar
      ? `${p.theme.space.md} 0 ${p.theme.space.sm} var(--issue-details-inset, ${p.theme.space['2xl']})`
      : `${p.theme.space.sm} var(--issue-details-inset, ${p.theme.space['2xl']}) ${p.theme.space.xs} var(--issue-details-inset, ${p.theme.space['2xl']})`};
`;

const ContentPadding = styled('div')`
  min-height: 100vh;
  padding: 0 var(--issue-details-inset, ${p => p.theme.space['2xl']})
    ${p => p.theme.space['2xl']} var(--issue-details-inset, ${p => p.theme.space['2xl']});
`;
