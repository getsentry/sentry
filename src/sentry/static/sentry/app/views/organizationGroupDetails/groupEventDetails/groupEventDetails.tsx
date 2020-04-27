import * as Sentry from '@sentry/browser';
import {browserHistory} from 'react-router';
import isEqual from 'lodash/isEqual';
import PropTypes from 'prop-types';
import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {Client} from 'app/api';
import {fetchSentryAppComponents} from 'app/actionCreators/sentryAppComponents';
import {withMeta} from 'app/components/events/meta/metaProxy';
import EventEntries from 'app/components/events/eventEntries';
import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import GroupEventDetailsLoadingError from 'app/components/errors/groupEventDetailsLoadingError';
import GroupSidebar from 'app/components/group/sidebar';
import LoadingIndicator from 'app/components/loadingIndicator';
import MutedBox from 'app/components/mutedBox';
import ResolutionBox from 'app/components/resolutionBox';
import SentryTypes from 'app/sentryTypes';
import fetchSentryAppInstallations from 'app/utils/fetchSentryAppInstallations';
import {Group, Project, Organization, Environment, Event} from 'app/types';

import {fetchGroupEventAndMarkSeen, getEventEnvironment} from '../utils';
import GroupEventToolbar from '../eventToolbar';

type Props = RouteComponentProps<
  {orgId: string; groupId: string; eventId?: string},
  {}
> & {
  api: Client;
  group: Group;
  project: Project;
  organization: Organization;
  environments: Environment[];
};

type State = {
  loading: boolean;
  error: boolean;
  event: Event | null;
  eventNavLinks: string;
  releasesCompletion: any;
};

class GroupEventDetails extends React.Component<Props, State> {
  static propTypes = {
    api: PropTypes.object.isRequired,
    group: SentryTypes.Group.isRequired,
    project: SentryTypes.Project.isRequired,
    organization: SentryTypes.Organization.isRequired,
    environments: PropTypes.arrayOf(SentryTypes.Environment).isRequired,
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      loading: true,
      error: false,
      event: null,
      eventNavLinks: '',
      releasesCompletion: null,
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const {environments, params, location} = this.props;

    const eventHasChanged = prevProps.params.eventId !== params.eventId;
    const environmentsHaveChanged = !isEqual(prevProps.environments, environments);

    // If environments are being actively changed and will no longer contain the
    // current event's environment, redirect to latest
    if (
      environmentsHaveChanged &&
      prevState.event &&
      params.eventId &&
      !['latest', 'oldest'].includes(params.eventId)
    ) {
      const shouldRedirect =
        environments.length > 0 &&
        !environments.find(env => env.name === getEventEnvironment(prevState.event));

      if (shouldRedirect) {
        browserHistory.replace({
          pathname: `/organizations/${params.orgId}/issues/${params.groupId}/`,
          query: location.query,
        });
        return;
      }
    }

    if (eventHasChanged || environmentsHaveChanged) {
      this.fetchData();
    }
  }

  componentWillUnmount() {
    const {api, organization} = this.props;

    // Note: We do not load global selection store with any data when this component is used
    // This is handled in `<OrganizationContext>` by examining the routes.
    //
    // When this view gets unmounted, attempt to load initial data so that projects/envs
    // gets loaded with the last used one (via local storage). `forceUrlSync` will make
    // `<GlobalSelectionHeader>` sync values from store to the URL (if they are different),
    // otherwise they can out of sync because the component only syncs in `DidMount`, and
    // the timing for that is not guaranteed.
    //
    // TBD: if this behavior is actually desired
    if (organization.projects) {
      GlobalSelectionStore.loadInitialData(organization, this.props.location.query, {
        api: this.props.api,
        onlyIfNeverLoaded: true,
        forceUrlSync: true,
      });
    }

    api.clear();
  }

  fetchData = async () => {
    const {api, group, project, organization, params, environments} = this.props;
    const eventId = params.eventId || 'latest';
    const groupId = group.id;
    const orgSlug = organization.slug;
    const projSlug = project.slug;
    const projectId = project.id;

    this.setState({
      loading: true,
      error: false,
    });

    const envNames = environments.map(e => e.name);

    /**
     * Perform below requests in parallel
     */
    const releasesCompletionPromise = api.requestPromise(
      `/projects/${orgSlug}/${projSlug}/releases/completion/`
    );
    const fetchGroupEventPromise = fetchGroupEventAndMarkSeen(
      api,
      orgSlug,
      projSlug,
      groupId,
      eventId,
      envNames
    );

    fetchSentryAppInstallations(api, orgSlug);
    fetchSentryAppComponents(api, orgSlug, projectId);

    const releasesCompletion = await releasesCompletionPromise;
    this.setState({
      releasesCompletion,
    });

    try {
      const event = await fetchGroupEventPromise;
      this.setState({
        event,
        error: false,
        loading: false,
      });
    } catch (err) {
      // This is an expected error, capture to Sentry so that it is not considered as an unhandled error
      Sentry.captureException(err);
      this.setState({
        event: null,
        error: true,
        loading: false,
      });
    }
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

  render() {
    const {group, project, organization, environments, location} = this.props;
    const evt = withMeta(this.state.event);

    return (
      <div>
        <div className="event-details-container">
          <div className="primary">
            {evt && (
              <GroupEventToolbar
                organization={organization}
                group={group}
                event={evt}
                orgId={organization.slug}
                projectId={project.slug}
                location={location}
              />
            )}
            {group.status === 'ignored' && (
              <MutedBox statusDetails={group.statusDetails} />
            )}
            {group.status === 'resolved' && (
              <ResolutionBox statusDetails={group.statusDetails} projectId={project.id} />
            )}
            {this.state.loading ? (
              <LoadingIndicator />
            ) : this.state.error ? (
              <GroupEventDetailsLoadingError
                environments={environments}
                onRetry={this.fetchData}
              />
            ) : (
              <EventEntries
                group={group}
                event={evt}
                organization={organization}
                project={project}
                location={location}
                showExampleCommit={this.showExampleCommit}
              />
            )}
          </div>
          <div className="secondary">
            <GroupSidebar
              organization={organization}
              project={project}
              group={group}
              event={evt}
              environments={environments}
            />
          </div>
        </div>
      </div>
    );
  }
}

export default GroupEventDetails;
