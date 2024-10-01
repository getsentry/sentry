import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import ArchivedBox from 'sentry/components/archivedBox';
import GroupEventDetailsLoadingError from 'sentry/components/errors/groupEventDetailsLoadingError';
import {withMeta} from 'sentry/components/events/meta/metaProxy';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {TransactionProfileIdProvider} from 'sentry/components/profiling/transactionProfileIdProvider';
import ResolutionBox from 'sentry/components/resolutionBox';
import {TabList, Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import useSentryAppComponentsData from 'sentry/stores/useSentryAppComponentsData';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group, GroupActivityReprocess, GroupReprocessing} from 'sentry/types/group';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {browserHistory} from 'sentry/utils/browserHistory';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import usePrevious from 'sentry/utils/usePrevious';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import GroupEventDetailsContent from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent';
import GroupEventHeader from 'sentry/views/issueDetails/groupEventHeader';
import GroupSidebar from 'sentry/views/issueDetails/groupSidebar';
import {EventPageContent} from 'sentry/views/issueDetails/streamline/eventDetails';
import StreamlinedSidebar from 'sentry/views/issueDetails/streamline/sidebar';

import ReprocessingProgress from '../reprocessingProgress';
import {
  getEventEnvironment,
  getGroupMostRecentActivity,
  ReprocessingStatus,
  useEnvironmentsFromUrl,
  useHasStreamlinedUI,
} from '../utils';

const EscalatingIssuesFeedback = HookOrDefault({
  hookName: 'component:escalating-issues-banner-feedback',
});

export interface GroupEventDetailsProps
  extends RouteComponentProps<{groupId: string; eventId?: string}, {}> {
  eventError: boolean;
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  loadingEvent: boolean;
  onRetry: () => void;
  organization: Organization;
  project: Project;
  event?: Event;
}

function GroupEventDetails(props: GroupEventDetailsProps) {
  const {
    group,
    project,
    organization,
    location,
    event,
    groupReprocessingStatus,
    loadingEvent,
    onRetry,
    eventError,
    params,
  } = props;
  const projectId = project.id;
  const environments = useEnvironmentsFromUrl();
  const prevEnvironment = usePrevious(environments);
  const prevEvent = usePrevious(event);
  const hasStreamlinedUI = useHasStreamlinedUI();

  const [pageContent, setPageContent] = useSyncedLocalStorageState<EventPageContent>(
    'issue-details-tab-i-guess',
    EventPageContent.EVENT
  );
  // load the data
  useSentryAppComponentsData({projectId});

  // If environments are being actively changed and will no longer contain the
  // current event's environment, redirect to latest
  useEffect(() => {
    const environmentsHaveChanged = !isEqual(prevEnvironment, environments);
    // If environments are being actively changed and will no longer contain the
    // current event's environment, redirect to latest
    if (
      environmentsHaveChanged &&
      prevEvent &&
      params.eventId &&
      !['latest', 'oldest'].includes(params.eventId)
    ) {
      const shouldRedirect =
        environments.length > 0 &&
        !environments.find(env => env === getEventEnvironment(prevEvent as Event));

      if (shouldRedirect) {
        browserHistory.replace(
          normalizeUrl({
            pathname: `/organizations/${organization.slug}/issues/${params.groupId}/`,
            query: location.query,
          })
        );
        return;
      }
    }
  }, [
    prevEnvironment,
    environments,
    location.query,
    organization.slug,
    params,
    prevEvent,
  ]);

  const renderGroupStatusBanner = () => {
    if (group.status === 'ignored') {
      return (
        <GroupStatusBannerWrapper>
          <ArchivedBox
            substatus={group.substatus}
            statusDetails={group.statusDetails}
            organization={organization}
          />
        </GroupStatusBannerWrapper>
      );
    }

    if (group.status === 'resolved') {
      return (
        <GroupStatusBannerWrapper>
          <ResolutionBox
            statusDetails={group.statusDetails}
            activities={group.activity}
            projectId={project.id}
          />
        </GroupStatusBannerWrapper>
      );
    }

    return null;
  };

  const renderContent = () => {
    if (loadingEvent) {
      return <LoadingIndicator />;
    }

    if (eventError) {
      return (
        <GroupEventDetailsLoadingError environments={environments} onRetry={onRetry} />
      );
    }

    return (
      <GroupEventDetailsContent group={group} event={eventWithMeta} project={project} />
    );
  };

  const eventWithMeta = withMeta(event);
  const issueTypeConfig = getConfigForIssueType(group, project);
  const PageLayoutComponent = hasStreamlinedUI ? PageLayout : StyledLayoutBody;
  const MainLayoutComponent = hasStreamlinedUI ? GroupContent : StyledLayoutMain;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <TransactionProfileIdProvider
      projectId={event?.projectID}
      transactionId={event?.type === 'transaction' ? event.id : undefined}
      timestamp={event?.dateReceived}
    >
      <VisuallyCompleteWithData
        id="IssueDetails-EventBody"
        hasData={!loadingEvent && !eventError && defined(eventWithMeta)}
        isLoading={loadingEvent}
      >
        <PageLayoutComponent
          data-test-id="group-event-details"
          hasStreamlinedUi={hasStreamlinedUI}
          isSidebarOpen={isSidebarOpen}
        >
          {groupReprocessingStatus === ReprocessingStatus.REPROCESSING ? (
            <ReprocessingProgress
              totalEvents={
                (getGroupMostRecentActivity(group.activity) as GroupActivityReprocess)
                  .data.eventCount
              }
              pendingEvents={
                (group.statusDetails as GroupReprocessing['statusDetails']).pendingEvents
              }
            />
          ) : (
            <Fragment>
              <MainLayoutComponent>
                {hasStreamlinedUI && (
                  <IssueDetailsTabs
                    value={pageContent}
                    onChange={key => setPageContent(key as EventPageContent)}
                  >
                    <IssueDetailsTabList hideBorder variant="floating">
                      <TabList.Item key={EventPageContent.EVENT}>
                        {t('Event')}
                      </TabList.Item>
                      <TabList.Item key={EventPageContent.ISSUE}>
                        {t('Issue')}
                      </TabList.Item>
                      <TabList.Item key={EventPageContent.EXPLORE}>
                        {t('Explore')}
                      </TabList.Item>
                    </IssueDetailsTabList>
                  </IssueDetailsTabs>
                )}
                {!hasStreamlinedUI && renderGroupStatusBanner()}
                <EscalatingIssuesFeedback organization={organization} group={group} />
                {eventWithMeta && issueTypeConfig.stats.enabled && !hasStreamlinedUI && (
                  <GroupEventHeader
                    group={group}
                    event={eventWithMeta}
                    project={project}
                  />
                )}
                {renderContent()}
              </MainLayoutComponent>
              {hasStreamlinedUI ? (
                <StreamlinedSide>
                  <StreamlinedSidebar
                    group={group}
                    event={event}
                    project={project}
                    groupReprocessingStatus={groupReprocessingStatus}
                    isSidebarOpen={isSidebarOpen}
                    onToggleSidebar={() => setIsSidebarOpen(v => !v)}
                  />
                </StreamlinedSide>
              ) : (
                <StyledLayoutSide>
                  <GroupSidebar
                    organization={organization}
                    project={project}
                    group={group}
                    event={eventWithMeta}
                    environments={environments}
                  />
                </StyledLayoutSide>
              )}
            </Fragment>
          )}
        </PageLayoutComponent>
      </VisuallyCompleteWithData>
    </TransactionProfileIdProvider>
  );
}

const IssueDetailsTabs = styled(Tabs)`
  gap: ${space(1.5)};
  background: ${p => p.theme.background};
  padding: ${space(0.5)} ${space(1.5)} ${space(0.75)};
  border-bottom: 1px solid ${p => p.theme.translucentBorder};
  margin: -${space(1.5)} -${space(1.5)} 0;
`;

const IssueDetailsTabList = styled(TabList)`
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  line-height: 1;
`;

const StyledLayoutBody = styled(Layout.Body)<{
  hasStreamlinedUi: boolean;
}>`
  /* Makes the borders align correctly */
  padding: 0 !important;
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    align-content: stretch;
  }
`;

const GroupStatusBannerWrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const StyledLayoutMain = styled(Layout.Main)`
  padding-top: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    padding-top: ${space(1)};
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    border-right: 1px solid ${p => p.theme.border};
    padding-right: 0;
  }
`;

const GroupContent = styled(Layout.Main)`
  background: ${p => p.theme.backgroundSecondary};
  display: flex;
  flex-direction: column;
  padding: ${space(1.5)};
  gap: ${space(1.5)};
`;

const PageLayout = styled(Layout.Body)<{isSidebarOpen: boolean}>`
  padding: 0 !important;
  gap: 0 !important;
  background: ${p => p.theme.backgroundSecondary};
  grid-template-columns: ${p =>
    p.isSidebarOpen
      ? 'minmax(100px, auto) 325px'
      : 'minmax(100px, auto) 40px'} !important;
`;

const StyledLayoutSide = styled(Layout.Side)`
  padding: ${space(3)} ${space(2)} ${space(3)};

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    padding-right: ${space(4)};
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    padding-left: 0;
  }
`;

const StreamlinedSide = styled('div')`
  grid-area: 1 / 2 / 3 / 3;
`;

export default GroupEventDetails;
