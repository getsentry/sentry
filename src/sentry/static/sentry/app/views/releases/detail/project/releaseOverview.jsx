import PropTypes from 'prop-types';
import React from 'react';

import createReactClass from 'create-react-class';

import withEnvironmentInQueryString from 'app/utils/withEnvironmentInQueryString';
import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingError from 'app/components/loadingError';
import LastCommit from 'app/components/lastCommit';
import CommitAuthorStats from 'app/components/commitAuthorStats';
import ReleaseProjectStatSparkline from 'app/components/releaseProjectStatSparkline';
import RepositoryFileSummary from 'app/components/repositoryFileSummary';

import ApiMixin from 'app/mixins/apiMixin';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import OrganizationState from 'app/mixins/organizationState';

import {getFilesByRepository} from '../shared/utils';
import ReleaseDeploys from '../shared/releaseDeploys';
import ReleaseEmptyState from '../shared/releaseEmptyState';
import ReleaseIssues from '../shared/releaseIssues';

const ReleaseOverview = createReactClass({
  displayName: 'ReleaseOverview',

  propTypes: {
    environment: SentryTypes.Environment,
  },

  contextTypes: {
    release: PropTypes.object,
  },

  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      projects: [],
      fileList: [],
      deploys: [],
      hasRepos: false,
    };
  },

  componentDidMount() {
    this.fetchAll();
  },

  componentDidUpdate(prevProps) {
    if (prevProps.environment !== this.props.environment) {
      this.fetchAll();
    }
  },

  fetchAll() {
    const {orgId, version} = this.props.params;
    const query = {
      ...this.props.location.query,
    };

    if (this.props.environment) {
      query.environment = this.props.environment.name;
    } else {
      delete query.environment;
    }

    const path = `/organizations/${orgId}/releases/${encodeURIComponent(
      version
    )}/commitfiles/`;
    this.api.request(path, {
      method: 'GET',
      data: query,
      success: (data, _, jqXHR) => {
        this.setState({
          fileList: data,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      },
    });
    this.getReleaseProjects();
    this.getDeploys();
    this.getRepos();
  },

  getReleaseProjects() {
    const {orgId, version} = this.props.params;
    const query = this.props.environment
      ? {environment: this.props.environment.name}
      : {};

    const path = `/organizations/${orgId}/releases/${encodeURIComponent(version)}/`;
    this.api.request(path, {
      query,
      method: 'GET',
      success: (data, _, jqXHR) => {
        this.setState({
          projects: data.projects,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      },
    });
  },

  getDeploys() {
    const {orgId, version} = this.props.params;

    const path = `/organizations/${orgId}/releases/${encodeURIComponent(
      version
    )}/deploys/`;
    this.api.request(path, {
      method: 'GET',
      success: (data, _, jqXHR) => {
        this.setState({
          deploys: data,
          loading: false,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      },
    });
  },

  getRepos() {
    const {orgId} = this.props.params;
    const query = this.props.environment
      ? {environment: this.props.environment.name}
      : {};

    const path = `/organizations/${orgId}/repos/`;
    this.api.request(path, {
      method: 'GET',
      query,
      success: (data, _, jqXHR) => {
        this.setState({
          hasRepos: data.length > 0,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      },
    });
  },

  renderEmpty() {
    return <div className="box empty">{t('None')}</div>;
  },

  render() {
    const {orgId, projectId, version} = this.props.params;
    const {release} = this.context;
    const lastCommit = release.lastCommit;

    if (this.state.loading) {
      return <LoadingIndicator />;
    }

    if (this.state.error) {
      return <LoadingError />;
    }

    const {fileList, projects, hasRepos} = this.state;

    const filesByRepository = getFilesByRepository(fileList);

    const query = this.props.environment
      ? {environment: this.props.environment.name}
      : {};

    return (
      <div>
        <div className="row" style={{paddingTop: 10}}>
          <div className="col-sm-8">
            <ReleaseIssues
              version={version}
              query={query}
              orgId={orgId}
              projectId={projectId}
            />
            {hasRepos && (
              <div>
                {Object.keys(filesByRepository).map((repository, i) => {
                  return (
                    <RepositoryFileSummary
                      key={i}
                      repository={repository}
                      fileChangeSummary={filesByRepository[repository]}
                    />
                  );
                })}
              </div>
            )}
          </div>
          <div className="col-sm-4">
            {hasRepos ? (
              <div>
                {lastCommit && (
                  <LastCommit commit={lastCommit} headerClass="nav-header" />
                )}
                <CommitAuthorStats
                  orgId={orgId}
                  projectId={projectId}
                  version={version}
                />
                <h6 className="nav-header m-b-1">{t('Other Projects Affected')}</h6>
                <ul className="nav nav-stacked">
                  {projects.length === 1
                    ? this.renderEmpty()
                    : projects.map(project => {
                        if (project.slug === projectId) {
                          return null;
                        }
                        return (
                          <ReleaseProjectStatSparkline
                            key={project.id}
                            orgId={orgId}
                            project={project}
                            version={version}
                          />
                        );
                      })}
                </ul>
              </div>
            ) : (
              <ReleaseEmptyState />
            )}
            <ReleaseDeploys
              deploys={this.state.deploys}
              version={version}
              orgId={orgId}
              projectId={projectId}
            />
          </div>
        </div>
      </div>
    );
  },
});

export default withEnvironmentInQueryString(ReleaseOverview);
