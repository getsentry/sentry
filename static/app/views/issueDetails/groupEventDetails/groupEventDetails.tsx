import {Fragment, useEffect} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import AnalyticsArea from 'sentry/components/analyticsArea';
import ArchivedBox from 'sentry/components/archivedBox';
import GroupEventDetailsLoadingError from 'sentry/components/errors/groupEventDetailsLoadingError';
import {withMeta} from 'sentry/components/events/meta/metaProxy';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {TransactionProfileIdProvider} from 'sentry/components/profiling/transactionProfileIdProvider';
import ResolutionBox from 'sentry/components/resolutionBox';
import useSentryAppComponentsData from 'sentry/stores/useSentryAppComponentsData';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group, GroupActivityReprocess, GroupReprocessing} from 'sentry/types/group';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {browserHistory} from 'sentry/utils/browserHistory';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import GroupEventDetailsContent from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent';
import {GroupEventDetailsLoading} from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsLoading';
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

export interface GroupEventDetailsProps
  extends RouteComponentProps<{groupId: string; orgId: string; eventId?: string}, {}> {
  eventError: boolean;
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  loadingEvent: boolean;
  onRetry: () => void;
  project: Project;
  event?: Event;
}

function GroupEventDetails(props: GroupEventDetailsProps) {
  const organization = useOrganization();
  const {
    group,
    project,
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
      if (hasStreamlinedUI) {
        return <GroupEventDetailsLoading />;
      }
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
  const LayoutBody = hasStreamlinedUI ? 'div' : StyledLayoutBody;
  const MainLayoutComponent = hasStreamlinedUI ? 'div' : StyledLayoutMain;

  return (
    <AnalyticsArea name="issue_details">
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
          <LayoutBody data-test-id="group-event-details">
            {groupReprocessingStatus === ReprocessingStatus.REPROCESSING ? (
              <ReprocessingProgress
                totalEvents={
                  (getGroupMostRecentActivity(group.activity) as GroupActivityReprocess)
                    .data.eventCount
                }
                pendingEvents={
                  (group.statusDetails as GroupReprocessing['statusDetails'])
                    .pendingEvents
                }
              />
            ) : (
              <Fragment>
                <MainLayoutComponent>
                  {!hasStreamlinedUI && renderGroupStatusBanner()}
                  {eventWithMeta &&
                    issueTypeConfig.stats.enabled &&
                    !hasStreamlinedUI && (
                      <GroupEventHeader
                        group={group}
                        event={eventWithMeta}
                        project={project}
                      />
                    )}
                  {renderContent()}
                </MainLayoutComponent>
                {hasStreamlinedUI ? null : (
                  <StyledLayoutSide hasStreamlinedUi={hasStreamlinedUI}>
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
          </LayoutBody>
        </VisuallyCompleteWithData>
      </TransactionProfileIdProvider>
    </AnalyticsArea>
  );
}

const StyledLayoutBody = styled(Layout.Body)`
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

const StyledLayoutSide = styled(Layout.Side)<{hasStreamlinedUi: boolean}>`
  ${p =>
    p.hasStreamlinedUi
      ? css`
          padding: ${space(1.5)} ${space(2)};
        `
      : css`
          padding: ${space(3)} ${space(2)} ${space(3)};

          @media (min-width: ${p.theme.breakpoints.large}) {
            padding-right: ${space(4)};
          }
        `}

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    padding-left: ${p => (p.hasStreamlinedUi ? space(0.5) : 0)};
  }
`;

export default GroupEventDetails;
