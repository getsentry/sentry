import {Fragment, useEffect} from 'react';
import {css} from '@emotion/react';
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
import GroupEventDetailsContent from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent';
import GroupEventHeader from 'sentry/views/issueDetails/groupEventHeader';
import GroupSidebar from 'sentry/views/issueDetails/groupSidebar';

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
  const MainLayoutComponent = hasStreamlinedUI ? GroupContent : StyledLayoutMain;

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
        <StyledLayoutBody
          data-test-id="group-event-details"
          hasStreamlinedUi={hasStreamlinedUI}
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
              <StyledLayoutSide hasStreamlinedUi={hasStreamlinedUI}>
                <GroupSidebar
                  organization={organization}
                  project={project}
                  group={group}
                  event={eventWithMeta}
                  environments={environments}
                />
              </StyledLayoutSide>
            </Fragment>
          )}
        </StyledLayoutBody>
      </VisuallyCompleteWithData>
    </TransactionProfileIdProvider>
  );
}

const StyledLayoutBody = styled(Layout.Body)<{hasStreamlinedUi: boolean}>`
  /* Makes the borders align correctly */
  padding: 0 !important;
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    align-content: stretch;
  }

  ${p =>
    p.hasStreamlinedUi &&
    css`
      @media (min-width: ${p.theme.breakpoints.large}) {
        gap: ${space(2)};
      }
    `}
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
  gap: ${space(1.5)};
  padding-top: ${space(1.5)};
  padding-bottom: ${space(1.5)};
  box-shadow: 0 0 0 1px ${p => p.theme.translucentInnerBorder};

  > * {
    margin-right: ${space(1.5)};
    margin-left: ${space(1.5)};
  }
`;

const StyledLayoutSide = styled(Layout.Side)<{hasStreamlinedUi: boolean}>`
  ${p =>
    p.hasStreamlinedUi
      ? css`
          padding: ${space(1.5)} ${space(2)} ${space(3)};
        `
      : css`
          padding: ${space(3)} ${space(2)} ${space(3)};

          @media (min-width: ${p.theme.breakpoints.large}) {
            padding-right: ${space(4)};
          }
        `}

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    padding-left: 0;
  }
`;

export default GroupEventDetails;
