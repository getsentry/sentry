import {Component, Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import isEqual from 'lodash/isEqual';

import {fetchSentryAppComponents} from 'sentry/actionCreators/sentryAppComponents';
import {Client} from 'sentry/api';
import GroupEventDetailsLoadingError from 'sentry/components/errors/groupEventDetailsLoadingError';
import {withMeta} from 'sentry/components/events/meta/metaProxy';
import GroupSidebar from 'sentry/components/group/sidebar';
import HookOrDefault from 'sentry/components/hookOrDefault';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import MutedBox from 'sentry/components/mutedBox';
import {TransactionProfileIdProvider} from 'sentry/components/profiling/transactionProfileIdProvider';
import ReprocessedBox from 'sentry/components/reprocessedBox';
import ResolutionBox from 'sentry/components/resolutionBox';
import {space} from 'sentry/styles/space';
import {
  BaseGroupStatusReprocessing,
  Environment,
  Group,
  GroupActivityReprocess,
  Organization,
  Project,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import fetchSentryAppInstallations from 'sentry/utils/fetchSentryAppInstallations';
import {QuickTraceContext} from 'sentry/utils/performance/quickTrace/quickTraceContext';
import QuickTraceQuery from 'sentry/utils/performance/quickTrace/quickTraceQuery';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import GroupEventDetailsContent from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent';
import GroupEventHeader from 'sentry/views/issueDetails/groupEventHeader';

import ReprocessingProgress from '../reprocessingProgress';
import {
  getEventEnvironment,
  getGroupMostRecentActivity,
  ReprocessingStatus,
} from '../utils';

const IssueFeedback = HookOrDefault({hookName: 'component:qualitative-issue-feedback'});

export interface GroupEventDetailsProps
  extends RouteComponentProps<{groupId: string; eventId?: string}, {}> {
  api: Client;
  environments: Environment[];
  eventError: boolean;
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  loadingEvent: boolean;
  onRetry: () => void;
  organization: Organization;
  project: Project;
  event?: Event;
}

type State = {
  eventNavLinks: string;
  releasesCompletion: any;
};

class GroupEventDetails extends Component<GroupEventDetailsProps, State> {
  state: State = {
    eventNavLinks: '',
    releasesCompletion: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: GroupEventDetailsProps) {
    const {environments, params, location, organization, project} = this.props;

    const environmentsHaveChanged = !isEqual(prevProps.environments, environments);

    // If environments are being actively changed and will no longer contain the
    // current event's environment, redirect to latest
    if (
      environmentsHaveChanged &&
      prevProps.event &&
      params.eventId &&
      !['latest', 'oldest'].includes(params.eventId)
    ) {
      const shouldRedirect =
        environments.length > 0 &&
        !environments.find(
          env => env.name === getEventEnvironment(prevProps.event as Event)
        );

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

    if (
      prevProps.organization.slug !== organization.slug ||
      prevProps.project.slug !== project.slug
    ) {
      this.fetchData();
    }
  }

  componentWillUnmount() {
    this.props.api.clear();
  }

  fetchData = async () => {
    const {api, project, organization} = this.props;
    const orgSlug = organization.slug;
    const projSlug = project.slug;
    const projectId = project.id;

    /**
     * Perform below requests in parallel
     */
    const releasesCompletionPromise = api.requestPromise(
      `/projects/${orgSlug}/${projSlug}/releases/completion/`
    );
    fetchSentryAppInstallations(api, orgSlug);

    // TODO(marcos): Sometimes PageFiltersStore cannot pick a project.
    if (projectId) {
      fetchSentryAppComponents(api, orgSlug, projectId);
    } else {
      Sentry.withScope(scope => {
        scope.setExtra('props', this.props);
        scope.setExtra('state', this.state);
        Sentry.captureMessage('Project ID was not set');
      });
    }

    const releasesCompletion = await releasesCompletionPromise;
    this.setState({releasesCompletion});
  };

  renderContent(eventWithMeta?: Event) {
    const {group, project, environments, loadingEvent, onRetry, eventError} = this.props;

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
  }

  renderReprocessedBox(
    reprocessStatus: ReprocessingStatus,
    mostRecentActivity: GroupActivityReprocess
  ) {
    if (
      reprocessStatus !== ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT &&
      reprocessStatus !== ReprocessingStatus.REPROCESSED_AND_HAS_EVENT
    ) {
      return null;
    }

    const {group, organization} = this.props;
    const {count, id: groupId} = group;
    const groupCount = Number(count);

    return (
      <ReprocessedBox
        reprocessActivity={mostRecentActivity}
        groupCount={groupCount}
        groupId={groupId}
        orgSlug={organization.slug}
      />
    );
  }

  renderGroupStatusBanner() {
    if (this.props.group.status === 'ignored') {
      return (
        <GroupStatusBannerWrapper>
          <MutedBox statusDetails={this.props.group.statusDetails} />
        </GroupStatusBannerWrapper>
      );
    }

    if (this.props.group.status === 'resolved') {
      return (
        <GroupStatusBannerWrapper>
          <ResolutionBox
            statusDetails={this.props.group.statusDetails}
            activities={this.props.group.activity}
            projectId={this.props.project.id}
          />
        </GroupStatusBannerWrapper>
      );
    }

    return null;
  }

  render() {
    const {
      group,
      project,
      organization,
      environments,
      location,
      event,
      groupReprocessingStatus,
      loadingEvent,
      eventError,
    } = this.props;

    const eventWithMeta = withMeta(event);

    // Reprocessing
    const hasReprocessingV2Feature = organization.features?.includes('reprocessing-v2');
    const {activity: activities} = group;
    const mostRecentActivity = getGroupMostRecentActivity(activities);

    return (
      <TransactionProfileIdProvider
        projectId={event?.projectID}
        transactionId={event?.type === 'transaction' ? event.id : undefined}
        timestamp={event?.dateReceived}
      >
        <VisuallyCompleteWithData
          id="IssueDetails-EventBody"
          hasData={!loadingEvent && !eventError && defined(eventWithMeta)}
        >
          <StyledLayoutBody data-test-id="group-event-details">
            {hasReprocessingV2Feature &&
            groupReprocessingStatus === ReprocessingStatus.REPROCESSING ? (
              <ReprocessingProgress
                totalEvents={
                  (mostRecentActivity as GroupActivityReprocess).data.eventCount
                }
                pendingEvents={
                  (group.statusDetails as BaseGroupStatusReprocessing['statusDetails'])
                    .pendingEvents
                }
              />
            ) : (
              <Fragment>
                <QuickTraceQuery
                  event={eventWithMeta}
                  location={location}
                  orgSlug={organization.slug}
                >
                  {results => {
                    return (
                      <StyledLayoutMain>
                        {this.renderGroupStatusBanner()}
                        <IssueFeedback
                          organization={organization}
                          group={group}
                          event={event}
                        />
                        <QuickTraceContext.Provider value={results}>
                          {eventWithMeta && (
                            <GroupEventHeader
                              group={group}
                              event={eventWithMeta}
                              project={project}
                            />
                          )}
                          {this.renderReprocessedBox(
                            groupReprocessingStatus,
                            mostRecentActivity as GroupActivityReprocess
                          )}
                          {this.renderContent(eventWithMeta)}
                        </QuickTraceContext.Provider>
                      </StyledLayoutMain>
                    );
                  }}
                </QuickTraceQuery>
                <StyledLayoutSide>
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

const StyledLayoutSide = styled(Layout.Side)`
  padding: ${space(3)} ${space(2)} ${space(3)};

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    padding-right: ${space(4)};
    padding-left: 0;
  }
`;

export default GroupEventDetails;
