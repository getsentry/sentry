import React from 'react';
import DocumentTitle from 'react-document-title';
import * as ReactRouter from 'react-router';
import * as Sentry from '@sentry/react';
import PropTypes from 'prop-types';

import {Client} from 'app/api';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import MissingProjectMembership from 'app/components/projects/missingProjectMembership';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import GroupStore from 'app/stores/groupStore';
import {PageContent} from 'app/styles/organization';
import {AvatarProject, Group, Organization, Project} from 'app/types';
import {Event} from 'app/types/event';
import {callIfFunction} from 'app/utils/callIfFunction';
import {getMessage, getTitle} from 'app/utils/events';
import Projects from 'app/utils/projects';
import recreateRoute from 'app/utils/recreateRoute';
import withApi from 'app/utils/withApi';

import {ERROR_TYPES} from './constants';
import GroupHeader, {TAB} from './header';
import {
  fetchGroupEvent,
  getGroupReprocessingStatus,
  markEventSeen,
  ReprocessingStatus,
} from './utils';

type Error = typeof ERROR_TYPES[keyof typeof ERROR_TYPES] | null;

type Props = {
  api: Client;
  organization: Organization;
  environments: string[];
  children: React.ReactNode;
  isGlobalSelectionReady: boolean;
} & ReactRouter.RouteComponentProps<
  {orgId: string; groupId: string; eventId?: string},
  {}
>;

type State = {
  group: Group | null;
  loading: boolean;
  loadingEvent: boolean;
  error: boolean;
  eventError: boolean;
  errorType: Error;
  project: null | (Pick<Project, 'id' | 'slug'> & Partial<Pick<Project, 'platform'>>);
  event?: Event;
};

class GroupDetails extends React.Component<Props, State> {
  static childContextTypes = {
    group: SentryTypes.Group,
    location: PropTypes.object,
  };

  state = this.initialState;

  getChildContext() {
    return {
      group: this.state.group,
      location: this.props.location,
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (prevProps.isGlobalSelectionReady !== this.props.isGlobalSelectionReady) {
      this.fetchData();
    }

    if (
      (!this.canLoadEventEarly(prevProps) && !prevState?.group && this.state.group) ||
      (prevProps.params?.eventId !== this.props.params?.eventId && this.state.group)
    ) {
      this.getEvent(this.state.group);
    }
  }

  componentWillUnmount() {
    GroupStore.reset();
    callIfFunction(this.listener);
  }

  get initialState(): State {
    return {
      group: null,
      loading: true,
      loadingEvent: true,
      error: false,
      eventError: false,
      errorType: null,
      project: null,
    };
  }

  remountComponent = () => {
    this.setState(this.initialState);
    this.fetchData();
  };

  canLoadEventEarly(props: Props) {
    return !props.params.eventId || ['oldest', 'latest'].includes(props.params.eventId);
  }

  get groupDetailsEndpoint() {
    return `/issues/${this.props.params.groupId}/`;
  }

  async getEvent(group?: Group) {
    if (group) {
      this.setState({loadingEvent: true, eventError: false});
    }

    const {params, environments, api} = this.props;
    const orgSlug = params.orgId;
    const groupId = params.groupId;
    const eventId = params?.eventId || 'latest';
    const projectId = group?.project?.slug;
    try {
      const event = await fetchGroupEvent(
        api,
        orgSlug,
        groupId,
        eventId,
        environments,
        projectId
      );
      this.setState({event, loading: false, eventError: false, loadingEvent: false});
    } catch (err) {
      // This is an expected error, capture to Sentry so that it is not considered as an unhandled error
      Sentry.captureException(err);
      this.setState({eventError: true, loading: false});
    }
  }

  getCurrentRouteInfo(group: Group): {currentTab: keyof typeof TAB; baseUrl: string} {
    const {routes, organization} = this.props;
    const {event} = this.state;

    // All the routes under /organizations/:orgId/issues/:groupId have a defined props
    const {currentTab, isEventRoute} = routes[routes.length - 1].props as {
      currentTab: keyof typeof TAB;
      isEventRoute: boolean;
    };

    const baseUrl =
      isEventRoute && event
        ? `/organizations/${organization.slug}/issues/${group.id}/events/${event.id}/`
        : `/organizations/${organization.slug}/issues/${group.id}/`;

    return {currentTab, baseUrl};
  }

  checkRedirectRoute() {}

  async fetchData() {
    const {
      environments,
      api,
      isGlobalSelectionReady,
      params,
      routes,
      location,
      organization,
    } = this.props;

    // Need to wait for global selection store to be ready before making request
    if (!isGlobalSelectionReady) {
      return;
    }

    try {
      let eventPromise: Promise<any> | undefined;
      if (this.canLoadEventEarly(this.props)) {
        eventPromise = this.getEvent();
      }

      const queryParams: Record<string, string | string[]> = {
        // Note, we do not want to include the environment key at all if there are no environments
        ...(environments ? {environment: environments} : {}),
      };
      if (organization?.features?.includes('inbox')) {
        queryParams.expand = 'inbox';
      }

      const groupPromise = await api.requestPromise(this.groupDetailsEndpoint, {
        query: queryParams,
      });
      const [data] = await Promise.all([groupPromise, eventPromise]);

      const projects = organization.projects;
      const projectId = data.project.id;
      const features = projects?.find(proj => proj.id === projectId)?.features ?? [];
      // Check for the reprocessing-v2 feature flag
      const hasReprocessingV2Feature = features.includes('reprocessing-v2');
      const reprocessingStatus = getGroupReprocessingStatus(data);
      const {currentTab, baseUrl} = this.getCurrentRouteInfo(data);

      if (this.props.params.groupId !== data.id) {
        if (hasReprocessingV2Feature) {
          // Redirects to the Activities tab
          if (
            reprocessingStatus === ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT &&
            currentTab !== TAB.ACTIVITY
          ) {
            ReactRouter.browserHistory.push({
              pathname: `${baseUrl}${TAB.ACTIVITY}/`,
              query: {...params, groupId: data.id},
            });
            return;
          }
        }

        ReactRouter.browserHistory.push(
          recreateRoute('', {
            routes,
            location,
            params: {...params, groupId: data.id},
          })
        );
        return;
      }

      if (hasReprocessingV2Feature) {
        if (
          reprocessingStatus === ReprocessingStatus.REPROCESSING &&
          currentTab !== TAB.DETAILS
        ) {
          ReactRouter.browserHistory.push({
            pathname: baseUrl,
            query: params,
          });
        }

        if (
          reprocessingStatus === ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT &&
          (currentTab !== TAB.ACTIVITY || currentTab !== TAB.USER_FEEDBACK)
        ) {
          ReactRouter.browserHistory.push({
            pathname: `${baseUrl}${TAB.ACTIVITY}/`,
            query: params,
          });
        }
      }

      const project = data.project;
      markEventSeen(api, params.orgId, project.slug, params.groupId);

      if (!project) {
        Sentry.withScope(() => {
          Sentry.captureException(new Error('Project not found'));
        });
      } else {
        const locationWithProject = {...this.props.location};
        if (
          locationWithProject.query.project === undefined &&
          locationWithProject.query._allp === undefined
        ) {
          //We use _allp as a temporary measure to know they came from the issue list page with no project selected (all projects included in filter).
          //If it is not defined, we add the locked project id to the URL (this is because if someone navigates directly to an issue on single-project priveleges, then goes back - they were getting assigned to the first project).
          //If it is defined, we do not so that our back button will bring us to the issue list page with no project selected instead of the locked project.
          locationWithProject.query.project = project.id;
        }
        delete locationWithProject.query._allp; //We delete _allp from the URL to keep the hack a bit cleaner, but this is not an ideal solution and will ultimately be replaced with something smarter.
        ReactRouter.browserHistory.replace(locationWithProject);
      }

      this.setState({project});

      GroupStore.loadInitialData([data]);
    } catch (err) {
      Sentry.captureException(err);
      let errorType: Error = null;
      switch (err?.status) {
        case 404:
          errorType = ERROR_TYPES.GROUP_NOT_FOUND;
          break;
        case 403:
          errorType = ERROR_TYPES.MISSING_MEMBERSHIP;
          break;
        default:
      }

      this.setState({
        error: true,
        errorType,
        loading: false,
      });
    }
  }

  listener = GroupStore.listen(itemIds => this.onGroupChange(itemIds), undefined);

  onGroupChange(itemIds: Set<string>) {
    const id = this.props.params.groupId;
    if (itemIds.has(id)) {
      const group = GroupStore.get(id) as Group;
      if (group) {
        // TODO(ts) This needs a better approach. issueActions is splicing attributes onto
        // group objects to cheat here.
        if ((group as Group & {stale?: boolean}).stale) {
          this.fetchData();
          return;
        }
        this.setState({
          group,
        });
      }
    }
  }

  getTitle() {
    const {organization} = this.props;
    const {group} = this.state;
    const defaultTitle = 'Sentry';

    if (!group) {
      return defaultTitle;
    }

    const {title} = getTitle(group, organization);
    const message = getMessage(group);

    if (title && message) {
      return `${title}: ${message}`;
    }

    return title || message || defaultTitle;
  }

  renderError() {
    const {organization, location} = this.props;
    const projects = organization.projects ?? [];
    const projectId = location.query.project;

    const projectSlug = projects.find(proj => proj.id === projectId)?.slug;

    switch (this.state.errorType) {
      case ERROR_TYPES.GROUP_NOT_FOUND:
        return (
          <LoadingError message={t('The issue you were looking for was not found.')} />
        );

      case ERROR_TYPES.MISSING_MEMBERSHIP:
        return (
          <MissingProjectMembership
            organization={this.props.organization}
            projectSlug={projectSlug}
          />
        );
      default:
        return <LoadingError onRetry={this.remountComponent} />;
    }
  }

  renderContent(project: AvatarProject) {
    const {children, environments} = this.props;
    const {loadingEvent, eventError} = this.state;

    // At this point group and event have to be defined
    const group = this.state.group!;
    const event = this.state.event;

    const {currentTab, baseUrl} = this.getCurrentRouteInfo(group);

    let childProps: Record<string, any> = {
      environments,
      group,
      project,
    };

    if (currentTab === TAB.DETAILS) {
      childProps = {
        ...childProps,
        event,
        loadingEvent,
        eventError,
        onRetry: () => this.remountComponent(),
      };
    }

    if (currentTab === TAB.TAGS) {
      childProps = {...childProps, event, baseUrl};
    }

    return (
      <React.Fragment>
        <GroupHeader
          project={project as Project}
          group={group}
          currentTab={currentTab}
          baseUrl={baseUrl}
        />
        {React.isValidElement(children)
          ? React.cloneElement(children, childProps)
          : children}
      </React.Fragment>
    );
  }

  render() {
    const {organization} = this.props;
    const {error: isError, group, project, loading} = this.state;
    const isLoading = loading || (!group && !isError);

    return (
      <DocumentTitle title={this.getTitle()}>
        <GlobalSelectionHeader
          skipLoadLastUsed
          forceProject={project}
          showDateSelector={false}
          shouldForceProject
          lockedMessageSubject={t('issue')}
          showIssueStreamLink
          showProjectSettingsLink
        >
          <PageContent>
            {isLoading ? (
              <LoadingIndicator />
            ) : isError ? (
              this.renderError()
            ) : (
              <Projects
                orgId={organization.slug}
                slugs={[project?.slug ?? '']}
                data-test-id="group-projects-container"
              >
                {({projects, initiallyLoaded, fetchError}) =>
                  initiallyLoaded ? (
                    fetchError ? (
                      <LoadingError message={t('Error loading the specified project')} />
                    ) : (
                      this.renderContent(projects[0])
                    )
                  ) : (
                    <LoadingIndicator />
                  )
                }
              </Projects>
            )}
          </PageContent>
        </GlobalSelectionHeader>
      </DocumentTitle>
    );
  }
}

export default withApi(Sentry.withProfiler(GroupDetails));
