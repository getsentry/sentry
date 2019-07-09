import {browserHistory} from 'react-router';
import {isEqual} from 'lodash';
import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import * as Sentry from '@sentry/browser';
import createReactClass from 'create-react-class';

import {PageContent} from 'app/styles/organization';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import GroupStore from 'app/stores/groupStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import ProjectsStore from 'app/stores/projectsStore';
import SentryTypes from 'app/sentryTypes';

import {ERROR_TYPES} from './constants';
import GroupHeader from './header';

const GroupDetails = createReactClass({
  displayName: 'GroupDetails',

  propTypes: {
    api: PropTypes.object,

    // Provided in the project version of group details
    project: SentryTypes.Project,

    organization: SentryTypes.Organization,
    environments: PropTypes.arrayOf(PropTypes.string),
    showGlobalHeader: PropTypes.bool,
  },

  childContextTypes: {
    group: SentryTypes.Group,
    location: PropTypes.object,
  },

  mixins: [Reflux.listenTo(GroupStore, 'onGroupChange')],

  getInitialState() {
    return {
      group: null,
      loading: true,
      error: false,
      errorType: null,
    };
  },

  getChildContext() {
    return {
      group: this.state.group,
      location: this.props.location,
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.params.groupId !== this.props.params.groupId) {
      this.remountComponent();
    }
  },

  componentDidUpdate(prevProps) {
    if (
      prevProps.params.groupId !== this.props.params.groupId ||
      !isEqual(prevProps.environments, this.props.environments)
    ) {
      this.fetchData();
    }
  },

  remountComponent() {
    this.setState(this.getInitialState());
  },

  fetchData() {
    const query = {};

    if (this.props.environments) {
      query.environment = this.props.environments;
    }

    this.props.api.request(this.getGroupDetailsEndpoint(), {
      query,
      success: data => {
        // TODO: Ideally, this would rebuild the route before parameter
        // interpolation, replace the `groupId` field of `this.routeParams`,
        // and use `formatPattern` from `react-router` to rebuild the URL,
        // rather than blindly pattern matching like we do here. Unfortunately,
        // `formatPattern` isn't actually exported until `react-router` 2.0.1:
        // https://github.com/reactjs/react-router/blob/v2.0.1/modules/index.js#L25
        if (this.props.params.groupId !== data.id) {
          const location = this.props.location;
          browserHistory.push(
            location.pathname.replace(
              `/issues/${this.props.params.groupId}/`,
              `/issues/${data.id}/`
            ) +
              location.search +
              location.hash
          );
          return;
        }

        const project = this.props.project || ProjectsStore.getById(data.project.id);

        if (!project) {
          Sentry.withScope(scope => {
            Sentry.captureException(new Error('Project not found'));
          });
        }

        this.setState({
          loading: false,
          error: false,
          errorType: null,
          project,
        });

        GroupStore.loadInitialData([data]);
      },
      error: (_, _textStatus, errorThrown) => {
        let errorType = null;
        switch (errorThrown) {
          case 'NOT FOUND':
            errorType = ERROR_TYPES.GROUP_NOT_FOUND;
            break;
          default:
        }
        this.setState({
          loading: false,
          error: true,
          errorType,
        });
      },
    });
  },

  onGroupChange(itemIds) {
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
  },

  getGroupDetailsEndpoint() {
    const id = this.props.params.groupId;

    return '/issues/' + id + '/';
  },

  getTitle() {
    const group = this.state.group;

    if (!group) {
      return 'Sentry';
    }

    switch (group.type) {
      case 'error':
        if (group.metadata.type && group.metadata.value) {
          return `${group.metadata.type}: ${group.metadata.value}`;
        }
        return group.metadata.type || group.metadata.value;
      case 'csp':
        return group.metadata.message;
      case 'expectct':
      case 'expectstaple':
      case 'hpkp':
        return group.metadata.message;
      case 'default':
        return group.metadata.title;
      default:
        return '';
    }
  },

  renderContent(shouldShowGlobalHeader) {
    const {environments} = this.props;
    const {group, project} = this.state;

    const Content = (
      <DocumentTitle title={this.getTitle()}>
        <div className={this.props.className}>
          <GroupHeader project={project} group={group} />
          {React.cloneElement(this.props.children, {
            environments,
            group,
            project,
          })}
        </div>
      </DocumentTitle>
    );

    // If we are showing global header (e.g. on Organization group details)
    // We need `<PageContent>` for padding, otherwise render content as normal
    if (shouldShowGlobalHeader) {
      return <PageContent>{Content}</PageContent>;
    }

    return Content;
  },

  render() {
    const {organization, showGlobalHeader} = this.props;
    const {group, project, loading} = this.state;

    if (this.state.error) {
      switch (this.state.errorType) {
        case ERROR_TYPES.GROUP_NOT_FOUND:
          return (
            <div className="alert alert-block">
              {t('The issue you were looking for was not found.')}
            </div>
          );
        default:
          return <LoadingError onRetry={this.remountComponent} />;
      }
    }

    const isLoading = loading || !group;

    return (
      <React.Fragment>
        {showGlobalHeader && (
          <GlobalSelectionHeader
            organization={organization}
            forceProject={project}
            showDateSelector={false}
            shouldForceProject
          />
        )}
        {isLoading ? (
          <PageContent>
            <LoadingIndicator />
          </PageContent>
        ) : (
          this.renderContent(showGlobalHeader)
        )}
      </React.Fragment>
    );
  },
});

export {GroupDetails};

export default withApi(GroupDetails);
