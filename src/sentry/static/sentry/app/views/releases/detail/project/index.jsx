import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import {browserHistory} from 'react-router';

import ApiMixin from 'app/mixins/apiMixin';

import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import ProjectState from 'app/mixins/projectState';
import SentryTypes from 'app/sentryTypes';

import withEnvironmentInQueryString from 'app/utils/withEnvironmentInQueryString';

import ReleaseHeader from '../shared/releaseHeader';

const ProjectReleaseDetails = createReactClass({
  displayName: 'ProjectReleaseDetails',

  propTypes: {
    setProjectNavSection: PropTypes.func,
    environment: SentryTypes.Environment,
  },

  contextTypes: {
    organization: SentryTypes.Organization,
  },

  childContextTypes: {
    release: PropTypes.object,
  },

  mixins: [ApiMixin, ProjectState],

  getInitialState() {
    return {
      release: null,
      loading: true,
      error: false,
    };
  },

  getChildContext() {
    return {
      release: this.state.release,
    };
  },

  componentWillMount() {
    // Redirect any Sentry 10 user that has followed an old link and ended up here
    const {location, params: {orgId, version}} = this.props;
    const hasSentry10 = new Set(this.context.organization.features).has('sentry10');
    if (hasSentry10) {
      browserHistory.replace(
        `/organizations/${orgId}/releases/${version}/${location.search}`
      );
    }

    this.props.setProjectNavSection('releases');
    this.fetchData();
  },

  componentDidUpdate(prevProps) {
    if (this.props.environment !== prevProps.environment) {
      this.fetchData();
    }
  },

  getTitle() {
    const project = this.getProject();
    const params = this.props.params;
    return 'Release ' + params.version + ' | ' + project.slug;
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    const {environment} = this.props;
    const query = environment ? {environment: environment.name} : {};

    this.api.request(this.getReleaseDetailsEndpoint(), {
      query,
      success: data => {
        this.setState({
          loading: false,
          release: data,
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      },
    });
  },

  getReleaseDetailsEndpoint() {
    const params = this.props.params;
    const orgId = params.orgId;
    const projectId = params.projectId;
    const version = encodeURIComponent(params.version);

    return `/projects/${orgId}/${projectId}/releases/${version}/`;
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    const release = this.state.release;
    const {orgId, projectId} = this.props.params;

    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="ref-release-details">
          <ReleaseHeader release={release} orgId={orgId} projectId={projectId} />
          {React.cloneElement(this.props.children, {
            release,
            environment: this.props.environment,
          })}
        </div>
      </DocumentTitle>
    );
  },
});

export default withEnvironmentInQueryString(ProjectReleaseDetails);
