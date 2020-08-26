import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import React from 'react';
import * as ReactRouter from 'react-router';
import * as Sentry from '@sentry/react';

import {Client} from 'app/api';
import {Group, Organization, Project, Event, AvatarProject} from 'app/types';
import {PageContent} from 'app/styles/organization';
import {callIfFunction} from 'app/utils/callIfFunction';
import {t} from 'app/locale';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import GroupStore from 'app/stores/groupStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Projects from 'app/utils/projects';
import SentryTypes from 'app/sentryTypes';
import recreateRoute from 'app/utils/recreateRoute';
import withApi from 'app/utils/withApi';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';

import {ERROR_TYPES} from './constants';
import {fetchGroupEventAndMarkSeen} from './utils';
import GroupHeader from './header';

// TODO(ts): Move this enum to the GroupHeader component as soon as it is converted to ts
enum TAB {
  DETAILS = 'details',
  COMMENTS = 'comments',
  USER_FEEDBACK = 'user_feedback',
  ATTACHMENTS = 'attachments',
  TAGS = 'tags',
  EVENTS = 'events',
  MERGED = 'merged',
  SIMILAR_ISSUES = 'similar_issues',
}

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
  error: boolean;
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

    if (!prevState?.group && this.state.group) {
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
      error: false,
      errorType: null,
      project: null,
    };
  }

  remountComponent = () => {
    this.setState(this.initialState);
    this.fetchData();
  };

  get groupDetailsEndpoint() {
    return `/issues/${this.props.params.groupId}/`;
  }

  async getEvent(group: Group) {
    const {params, environments, api, organization} = this.props;
    const orgSlug = organization.slug;
    const groupId = group.id;
    const projSlug = group.project.slug;
    const eventId = params?.eventId || 'latest';

    try {
      const event = await fetchGroupEventAndMarkSeen(
        api,
        orgSlug,
        projSlug,
        groupId,
        eventId,
        environments
      );
      this.setState({event, loading: false, error: false, errorType: null});
    } catch (err) {
      // This is an expected error, capture to Sentry so that it is not considered as an unhandled error
      Sentry.captureException(err);
      this.setState({error: true, errorType: null, loading: false});
    }
  }

  getRouteInfo() {
    const {routes} = this.props;
    const route = getRouteStringFromRoutes(routes);

    switch (route) {
      case '/organizations/:orgId/issues/:groupId/events/:eventId/feedback/':
        return {
          currentTab: TAB.USER_FEEDBACK,
          isEventRoute: true,
        };
      case '/organizations/:orgId/issues/:groupId/feedback/':
        return {
          currentTab: TAB.USER_FEEDBACK,
          isEventRoute: false,
        };
      case '/organizations/:orgId/issues/:groupId/events/:eventId/attachments/':
        return {
          currentTab: TAB.ATTACHMENTS,
          isEventRoute: true,
        };
      case '/organizations/:orgId/issues/:groupId/attachments/':
        return {
          currentTab: TAB.ATTACHMENTS,
          isEventRoute: false,
        };
      case '/organizations/:orgId/issues/:groupId/events/:eventId/similar/':
        return {
          currentTab: TAB.SIMILAR_ISSUES,
          isEventRoute: true,
        };
      case '/organizations/:orgId/issues/:groupId/similar/':
        return {
          currentTab: TAB.SIMILAR_ISSUES,
          isEventRoute: false,
        };
      case '/organizations/:orgId/issues/:groupId/events/:eventId/merged/':
        return {
          currentTab: TAB.MERGED,
          isEventRoute: true,
        };
      case '/organizations/:orgId/issues/:groupId/merged/':
        return {
          currentTab: TAB.MERGED,
          isEventRoute: false,
        };
      case '/organizations/:orgId/issues/:groupId/events/:eventId/tags/':
        return {
          currentTab: TAB.TAGS,
          isEventRoute: true,
        };
      case '/organizations/:orgId/issues/:groupId/tags/':
        return {
          currentTab: TAB.TAGS,
          isEventRoute: false,
        };
      case '/organizations/:orgId/issues/:groupId/events/:eventId/tags/:tagKey/':
        return {
          currentTab: TAB.TAGS,
          isEventRoute: true,
        };
      case '/organizations/:orgId/issues/:groupId/tags/:tagKey/':
        return {
          currentTab: TAB.TAGS,
          isEventRoute: false,
        };
      case '/organizations/:orgId/issues/:groupId/events/:eventId/activity/':
        return {
          currentTab: TAB.COMMENTS,
          isEventRoute: true,
        };
      case '/organizations/:orgId/issues/:groupId/activity/':
        return {
          currentTab: TAB.COMMENTS,
          isEventRoute: false,
        };
      case '/organizations/:orgId/issues/:groupId/events/:eventId/events/':
        return {
          currentTab: TAB.EVENTS,
          isEventRoute: true,
        };
      case '/organizations/:orgId/issues/:groupId/events/':
        return {
          currentTab: TAB.EVENTS,
          isEventRoute: false,
        };
      case '/organizations/:orgId/issues/:groupId/events/:eventId/':
        return {
          currentTab: TAB.DETAILS,
          isEventRoute: true,
        };
      default:
        return {
          currentTab: TAB.DETAILS,
          isEventRoute: false,
        };
    }
  }

  async fetchData() {
    const {environments, api, isGlobalSelectionReady} = this.props;

    // Need to wait for global selection store to be ready before making request
    if (!isGlobalSelectionReady) {
      return;
    }

    try {
      const data = await api.requestPromise(this.groupDetailsEndpoint, {
        query: {
          // Note, we do not want to include the environment key at all if there are no environments
          ...(environments ? {environment: environments} : {}),
        },
      });

      // TODO(billy): See if this is even in use and if not, can we just rip this out?
      if (this.props.params.groupId !== data.id) {
        const {routes, params, location} = this.props;
        ReactRouter.browserHistory.push(
          recreateRoute('', {
            routes,
            location,
            params: {...params, groupId: data.id},
          })
        );
        return;
      }
      const project = data.project;

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
      let errorType: Error = null;
      switch (err?.status) {
        case 404:
          errorType = ERROR_TYPES.GROUP_NOT_FOUND;
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

  listener = GroupStore.listen(itemIds => this.onGroupChange(itemIds));

  onGroupChange(itemIds: Set<string>) {
    const id = this.props.params.groupId;
    if (itemIds.has(id)) {
      const group = GroupStore.get(id);
      if (group) {
        if (group.stale) {
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
    const {group} = this.state;

    const defaultTitle = 'Sentry';

    if (!group) {
      return defaultTitle;
    }

    switch (group.type) {
      case 'error':
        if (group.metadata.type && group.metadata.value) {
          return `${group.metadata.type}: ${group.metadata.value}`;
        }
        return group.metadata.type || group.metadata.value || defaultTitle;
      case 'csp':
        return group.metadata.message || defaultTitle;
      case 'expectct':
      case 'expectstaple':
      case 'hpkp':
        return group.metadata.message || defaultTitle;
      case 'default':
        return group.metadata.title || defaultTitle;
      default:
        return '';
    }
  }

  renderError() {
    if (!this.state.error) {
      return null;
    }

    switch (this.state.errorType) {
      case ERROR_TYPES.GROUP_NOT_FOUND:
        return (
          <LoadingError message={t('The issue you were looking for was not found.')} />
        );
      default:
        return <LoadingError onRetry={this.remountComponent} />;
    }
  }

  renderContent(project: AvatarProject) {
    const {children, environments, organization} = this.props;
    const {currentTab, isEventRoute} = this.getRouteInfo();

    // At this point group and event have to be defined
    const group = this.state.group!;
    const event = this.state.event!;

    const baseUrl = isEventRoute
      ? `/organizations/${organization.slug}/issues/${group.id}/events/${event.id}/`
      : `/organizations/${organization.slug}/issues/${group.id}/`;

    let childProps: Record<string, any> = {
      environments,
      group,
      project,
    };

    if (currentTab === TAB.DETAILS) {
      childProps = {...childProps, event};
    }

    if (currentTab === TAB.TAGS) {
      childProps = {...childProps, event, baseUrl};
    }

    if (currentTab === TAB.SIMILAR_ISSUES) {
      childProps = {...childProps, event};
    }

    return (
      <React.Fragment>
        <GroupHeader
          project={project}
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
    const {error, group, project, loading} = this.state;

    const isError = error;
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
                slugs={[project!.slug]}
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
