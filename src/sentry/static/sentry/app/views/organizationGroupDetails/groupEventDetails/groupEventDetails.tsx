import React from 'react';
import {browserHistory} from 'react-router';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import PropTypes from 'prop-types';

import {fetchSentryAppComponents} from 'app/actionCreators/sentryAppComponents';
import {Client} from 'app/api';
import GroupEventDetailsLoadingError from 'app/components/errors/groupEventDetailsLoadingError';
import EventEntries from 'app/components/events/eventEntries';
import {withMeta} from 'app/components/events/meta/metaProxy';
import GroupSidebar from 'app/components/group/sidebar';
import LoadingIndicator from 'app/components/loadingIndicator';
import MutedBox from 'app/components/mutedBox';
import ResolutionBox from 'app/components/resolutionBox';
import SentryTypes from 'app/sentryTypes';
import {Environment, Event, Group, Organization, Project} from 'app/types';
import {metric} from 'app/utils/analytics';
import fetchSentryAppInstallations from 'app/utils/fetchSentryAppInstallations';

import GroupEventToolbar from '../eventToolbar';
import {getEventEnvironment} from '../utils';

type Props = RouteComponentProps<
  {orgId: string; groupId: string; eventId?: string},
  {}
> & {
  api: Client;
  group: Group;
  project: Project;
  organization: Organization;
  environments: Environment[];
  event?: Event;
  loadingEvent: boolean;
  eventError: boolean;
  onRetry: () => void;
  className?: string;
};

type State = {
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

  state: State = {
    eventNavLinks: '',
    releasesCompletion: null,
  };

  componentDidMount() {
    this.fetchData();

    // First Meaningful Paint for /organizations/:orgId/issues/:groupId/
    metric.measure({
      name: 'app.page.perf.issue-details',
      start: 'page-issue-details-start',
      data: {
        // start_type is set on 'page-issue-details-start'
        org_id: parseInt(this.props.organization.id, 10),
        group: this.props.organization.features.includes('enterprise-perf')
          ? 'enterprise-perf'
          : 'control',
        milestone: 'first-meaningful-paint',
        is_enterprise: this.props.organization.features
          .includes('enterprise-orgs')
          .toString(),
        is_outlier: this.props.organization.features
          .includes('enterprise-orgs-outliers')
          .toString(),
      },
    });
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
        !environments.find(env => env.name === getEventEnvironment(prevProps.event));

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

    // TODO(marcos): Sometimes GlobalSelectionStore cannot pick a project.
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

  render() {
    const {
      className,
      group,
      project,
      organization,
      environments,
      location,
      event,
      loadingEvent,
      eventError,
      onRetry,
    } = this.props;
    const evt = withMeta(event);

    return (
      <div className={className}>
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
            {loadingEvent ? (
              <LoadingIndicator />
            ) : eventError ? (
              <GroupEventDetailsLoadingError
                environments={environments}
                onRetry={onRetry}
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

export default styled(GroupEventDetails)`
  display: flex;
  flex: 1;
  flex-direction: column;
`;
