import {Component, Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import isEqual from 'lodash/isEqual';

import {fetchSentryAppComponents} from 'sentry/actionCreators/sentryAppComponents';
import {Client} from 'sentry/api';
import ErrorBoundary from 'sentry/components/errorBoundary';
import GroupEventDetailsLoadingError from 'sentry/components/errors/groupEventDetailsLoadingError';
import EventEntries from 'sentry/components/events/eventEntries';
import {withMeta} from 'sentry/components/events/meta/metaProxy';
import GroupSidebar from 'sentry/components/group/sidebar';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import MutedBox from 'sentry/components/mutedBox';
import ReprocessedBox from 'sentry/components/reprocessedBox';
import ResolutionBox from 'sentry/components/resolutionBox';
import SuggestProjectCTA from 'sentry/components/suggestProjectCTA';
import {
  BaseGroupStatusReprocessing,
  Environment,
  Group,
  GroupActivityReprocess,
  Organization,
  Project,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import fetchSentryAppInstallations from 'sentry/utils/fetchSentryAppInstallations';

import GroupEventToolbar from '../eventToolbar';
import ReprocessingProgress from '../reprocessingProgress';
import {
  getEventEnvironment,
  getGroupMostRecentActivity,
  ReprocessingStatus,
} from '../utils';

type Props = RouteComponentProps<
  {groupId: string; orgId: string; eventId?: string},
  {}
> & {
  api: Client;
  environments: Environment[];
  eventError: boolean;
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  loadingEvent: boolean;
  onRetry: () => void;
  organization: Organization;
  project: Project;
  className?: string;
  event?: Event;
};

type State = {
  eventNavLinks: string;
  releasesCompletion: any;
};

class GroupEventDetails extends Component<Props, State> {
  state: State = {
    eventNavLinks: '',
    releasesCompletion: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
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
        browserHistory.replace({
          pathname: `/organizations/${params.orgId}/issues/${params.groupId}/`,
          query: location.query,
        });
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
    const {api} = this.props;
    api.clear();
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

  get showExampleCommit() {
    const {project} = this.props;
    const {releasesCompletion} = this.state;
    return (
      project?.isMember &&
      project?.firstEvent &&
      releasesCompletion?.some(({step, complete}) => step === 'commit' && !complete)
    );
  }

  renderContent(eventWithMeta?: Event) {
    const {
      group,
      project,
      organization,
      environments,
      location,
      loadingEvent,
      onRetry,
      eventError,
      router,
      route,
    } = this.props;

    if (loadingEvent) {
      return <LoadingIndicator />;
    }

    if (eventError) {
      return (
        <GroupEventDetailsLoadingError environments={environments} onRetry={onRetry} />
      );
    }

    return (
      <EventEntries
        group={group}
        event={eventWithMeta}
        organization={organization}
        project={project}
        location={location}
        showExampleCommit={this.showExampleCommit}
        router={router}
        route={route}
      />
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

  render() {
    const {
      className,
      group,
      project,
      organization,
      environments,
      location,
      event,
      groupReprocessingStatus,
    } = this.props;

    const eventWithMeta = withMeta(event) as Event;

    // Reprocessing
    const hasReprocessingV2Feature = organization.features?.includes('reprocessing-v2');
    const {activity: activities} = group;
    const mostRecentActivity = getGroupMostRecentActivity(activities);

    return (
      <div className={className}>
        {event && (
          <ErrorBoundary customComponent={null}>
            <SuggestProjectCTA event={event} organization={organization} />
          </ErrorBoundary>
        )}
        <div className="event-details-container">
          {hasReprocessingV2Feature &&
          groupReprocessingStatus === ReprocessingStatus.REPROCESSING ? (
            <ReprocessingProgress
              totalEvents={(mostRecentActivity as GroupActivityReprocess).data.eventCount}
              pendingEvents={
                (group.statusDetails as BaseGroupStatusReprocessing['statusDetails'])
                  .pendingEvents
              }
            />
          ) : (
            <Fragment>
              <div className="primary">
                {eventWithMeta && (
                  <GroupEventToolbar
                    group={group}
                    event={eventWithMeta}
                    organization={organization}
                    location={location}
                    project={project}
                  />
                )}
                {group.status === 'ignored' && (
                  <MutedBox statusDetails={group.statusDetails} />
                )}
                {group.status === 'resolved' && (
                  <ResolutionBox
                    statusDetails={group.statusDetails}
                    activities={activities}
                    projectId={project.id}
                  />
                )}
                {this.renderReprocessedBox(
                  groupReprocessingStatus,
                  mostRecentActivity as GroupActivityReprocess
                )}
                {this.renderContent(eventWithMeta)}
              </div>
              <div className="secondary">
                <GroupSidebar
                  organization={organization}
                  project={project}
                  group={group}
                  event={eventWithMeta}
                  environments={environments}
                />
              </div>
            </Fragment>
          )}
        </div>
      </div>
    );
  }
}

export default styled(GroupEventDetails)`
  display: flex;
  flex: 1;
  flex-direction: column;
`;
