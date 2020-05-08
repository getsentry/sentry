import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import React from 'react';
import * as ReactRouter from 'react-router';
import * as Sentry from '@sentry/browser';

import {Client} from 'app/api';
import {Group, Organization, Project} from 'app/types';
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
import withProfiler from 'app/utils/withProfiler';

import {ERROR_TYPES} from './constants';
import GroupHeader from './header';

type Error = typeof ERROR_TYPES[keyof typeof ERROR_TYPES] | null;

type Props = {
  api: Client;
  organization: Organization;
  environments: string[];
  children: React.ReactNode;
  isGlobalSelectionReady: boolean;
  finishProfile: () => void;
} & ReactRouter.RouteComponentProps<{orgId: string; groupId: string}, {}>;

type State = {
  group: Group | null;
  loading: boolean;
  error: boolean;
  errorType: Error;
  project: null | (Pick<Project, 'id' | 'slug'> & Partial<Pick<Project, 'platform'>>);
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
    if (prevState.loading && !this.state.loading) {
      callIfFunction(this.props.finishProfile);
    }

    if (prevProps.isGlobalSelectionReady !== this.props.isGlobalSelectionReady) {
      this.fetchData();
    }
  }

  componentWillUnmount() {
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

      this.setState({
        error: false,
        loading: false,
        errorType: null,
        project,
      });

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
        loading: false,
        error: true,
        errorType,
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

  renderContent(project) {
    const {children, environments} = this.props;
    const {group} = this.state;

    return (
      <React.Fragment>
        <GroupHeader project={project} group={group} />
        {React.isValidElement(children)
          ? React.cloneElement(children, {
              environments,
              group,
              project,
            })
          : children}
      </React.Fragment>
    );
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

  render() {
    const {organization} = this.props;
    const {error, group, project, loading} = this.state;

    const isError = error;
    const isLoading = loading || (!group && !isError);

    return (
      <DocumentTitle title={this.getTitle()}>
        <React.Fragment>
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
                <Projects orgId={organization.slug} slugs={[project!.slug]}>
                  {({projects, initiallyLoaded, fetchError}) =>
                    initiallyLoaded ? (
                      fetchError ? (
                        <LoadingError
                          message={t('Error loading the specified project')}
                        />
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
        </React.Fragment>
      </DocumentTitle>
    );
  }
}

export default withApi(withProfiler(GroupDetails));
