import React from 'react';

import {Client} from 'app/api';
import {DEFAULT_QUERY} from 'app/constants';
import {LightWeightOrganization, Project} from 'app/types';
import {t} from 'app/locale';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import ErrorRobot from 'app/components/errorRobot';
import LoadingIndicator from 'app/components/loadingIndicator';

type Props = {
  api: Client;
  organization: LightWeightOrganization;
  query: string;
  selectedProjectIds?: number[];
  groupIds: number[];
};

type State = {
  fetchingSentFirstEvent: boolean;
  firstEventProjects?: Project[];
  sentFirstEvent?: boolean;
};

const CongratsRobots = React.lazy(() =>
  import(/* webpackChunkName: "CongratsRobots" */ 'app/views/issueList/congratsRobots')
);

/**
 * Component which is rendered when no groups/issues were found. This could
 * either be caused by having no first events, having resolved all issues, or
 * having no issues be returned from a query. This component will conditionally
 * render one of those states.
 */
class NoGroupsHandler extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      fetchingSentFirstEvent: true,
    };
  }

  componentDidMount() {
    this.fetchSentFirstEvent();
  }

  async fetchSentFirstEvent() {
    this.setState({
      fetchingSentFirstEvent: true,
    });

    const {organization, selectedProjectIds, api} = this.props;
    let sentFirstEvent = false;
    let projects = [];

    // If no projects are selected, then we must check every project the user is a
    // member of and make sure there are no first events for all of the projects
    let firstEventQuery = {};
    const projectsQuery = {per_page: 1, query: {}};
    if (!selectedProjectIds || !selectedProjectIds.length) {
      firstEventQuery = {is_member: true};
    } else {
      firstEventQuery = {project: selectedProjectIds};
      projectsQuery.query = selectedProjectIds.map(id => `id:${id}`).join(' ');
    }

    [{sentFirstEvent}, projects] = await Promise.all([
      // checks to see if selection has sent a first event
      api.requestPromise(`/organizations/${organization.slug}/sent-first-event/`, {
        query: firstEventQuery,
      }),
      // retrieves a single project to feed to the ErrorRobot from renderStreamBody
      api.requestPromise(`/organizations/${organization.slug}/projects/`, {
        query: projectsQuery,
      }),
    ]);

    this.setState({
      fetchingSentFirstEvent: false,
      sentFirstEvent,
      firstEventProjects: projects,
    });
  }

  renderLoading() {
    return <LoadingIndicator />;
  }

  renderAwaitingEvents(projects) {
    const {organization} = this.props;
    const project = projects.length > 0 ? projects[0] : null;

    const sampleIssueId = this.props.groupIds.length > 0 ? this.props.groupIds[0] : '';
    return (
      <ErrorRobot
        org={organization}
        project={project}
        sampleIssueId={sampleIssueId}
        gradient
      />
    );
  }

  renderNoUnresolvedIssues() {
    return (
      <React.Suspense fallback={this.renderLoading()}>
        <CongratsRobots data-test-id="congrats-robots" />
      </React.Suspense>
    );
  }

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t('Sorry, no issues match your filters.')}</p>
      </EmptyStateWarning>
    );
  }

  render() {
    const {fetchingSentFirstEvent, sentFirstEvent, firstEventProjects} = this.state;
    const {query} = this.props;
    // render things accordingly
    if (fetchingSentFirstEvent) {
      return this.renderLoading();
    } else if (!sentFirstEvent) {
      return this.renderAwaitingEvents(firstEventProjects);
    } else if (query === DEFAULT_QUERY) {
      return this.renderNoUnresolvedIssues();
    } else {
      return this.renderEmpty();
    }
  }
}

export default NoGroupsHandler;
