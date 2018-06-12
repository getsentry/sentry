import PropTypes from 'prop-types';
import React from 'react';

import createReactClass from 'create-react-class';

import withEnvironmentInQueryString from 'app/utils/withEnvironmentInQueryString';
import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingError from 'app/components/loadingError';
import IconOpen from 'app/icons/icon-open';
import LastCommit from 'app/components/lastCommit';
import IssueList from 'app/components/issueList';
import CommitAuthorStats from 'app/components/commitAuthorStats';
import ReleaseProjectStatSparkline from 'app/components/releaseProjectStatSparkline';
import RepositoryFileSummary from 'app/components/repositoryFileSummary';
import TimeSince from 'app/components/timeSince';

import ApiMixin from 'app/mixins/apiMixin';

import {t} from 'app/locale';
import SentryTypes from 'app/proptypes';
import OrganizationState from 'app/mixins/organizationState';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';

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
    let {orgId, version} = this.props.params;
    let query = {
      ...this.props.location.query,
    };

    if (this.props.environment) {
      query.environment = this.props.environment.name;
    } else {
      delete query.environment;
    }

    let path = `/organizations/${orgId}/releases/${encodeURIComponent(
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
    let {orgId, version} = this.props.params;
    let query = this.props.environment ? {environment: this.props.environment.name} : {};

    let path = `/organizations/${orgId}/releases/${encodeURIComponent(version)}/`;
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
    let {orgId, version} = this.props.params;

    let path = `/organizations/${orgId}/releases/${encodeURIComponent(version)}/deploys/`;
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
    let {orgId} = this.props.params;
    let query = this.props.environment ? {environment: this.props.environment.name} : {};

    let path = `/organizations/${orgId}/repos/`;
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
    let {orgId, projectId, version} = this.props.params;
    let {release} = this.context;
    let lastCommit = release.lastCommit;

    if (this.state.loading) return <LoadingIndicator />;

    if (this.state.error) return <LoadingError />;

    let {fileList, projects, hasRepos} = this.state;

    // convert list of individual file changes (can be
    // multiple changes to a single file) into a per-file
    // summary grouped by repository
    let filesByRepository = fileList.reduce(function(fbr, file) {
      let {filename, repoName, author, type} = file;
      if (!fbr.hasOwnProperty(repoName)) {
        fbr[repoName] = {};
      }
      if (!fbr[repoName].hasOwnProperty(filename)) {
        fbr[repoName][filename] = {
          authors: {},
          types: new Set(),
          repos: new Set(),
        };
      }

      fbr[repoName][filename].authors[author.email] = author;
      fbr[repoName][filename].types.add(type);

      return fbr;
    }, {});

    let deploys = this.state.deploys;

    let query = this.props.environment ? {environment: this.props.environment.name} : {};

    return (
      <div>
        <div className="row" style={{paddingTop: 10}}>
          <div className="col-sm-8">
            <h5>{t('Issues Resolved in this Release')}</h5>
            <IssueList
              endpoint={`/projects/${orgId}/${projectId}/releases/${encodeURIComponent(
                version
              )}/resolved/`}
              query={query}
              pagination={false}
              renderEmpty={() => (
                <Panel>
                  <PanelBody>
                    <PanelItem key="none" justify="center">
                      {t('No issues resolved')}
                    </PanelItem>
                  </PanelBody>
                </Panel>
              )}
              ref="issueList"
              showActions={false}
              params={{orgId}}
              className="m-b-2"
            />
            <h5>{t('New Issues in this Release')}</h5>
            <IssueList
              endpoint={`/projects/${orgId}/${projectId}/issues/`}
              query={{
                ...query,
                query: 'first-release:"' + version + '"',
                limit: 5,
              }}
              statsPeriod="0"
              pagination={false}
              renderEmpty={() => (
                <Panel>
                  <PanelBody>
                    <PanelItem justify="center">{t('No new issues')}</PanelItem>
                  </PanelBody>
                </Panel>
              )}
              ref="issueList"
              showActions={false}
              params={{orgId}}
              className="m-b-2"
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
              <div className="well blankslate m-t-2 m-b-2 p-x-2 p-t-1 p-b-2 align-center">
                <span className="icon icon-git-commit" />
                <h5>Releases are better with commit data!</h5>
                <p>
                  Connect a repository to see commit info, files changed, and authors
                  involved in future releases.
                </p>
                <a className="btn btn-primary" href={`/organizations/${orgId}/repos/`}>
                  Connect a repository
                </a>
              </div>
            )}
            <h6 className="nav-header m-b-1">{t('Deploys')}</h6>
            <ul className="nav nav-stacked">
              {!deploys.length
                ? this.renderEmpty()
                : deploys.map(deploy => {
                    let href = `/${orgId}/${projectId}/?query=release:${version}&environment=${encodeURIComponent(
                      deploy.environment
                    )}`;

                    // TODO(lyn): Remove when environment feature switched on
                    if (!this.getFeatures().has('environments')) {
                      let q = encodeURIComponent(
                        `environment:${deploy.environment} release:${version}`
                      );
                      href = `/${orgId}/${projectId}/?query=${q}`;
                    }
                    // End remove block

                    return (
                      <li key={deploy.id}>
                        <a href={href} title={t('View in stream')}>
                          <div className="row row-flex row-center-vertically">
                            <div className="col-xs-6">
                              <span
                                className="repo-label"
                                style={{verticalAlign: 'bottom'}}
                              >
                                {deploy.environment}
                                <IconOpen
                                  className="icon-open"
                                  size={11}
                                  style={{marginLeft: 6}}
                                />
                              </span>
                            </div>
                            <div className="col-xs-6 align-right">
                              <small>
                                <TimeSince date={deploy.dateFinished} />
                              </small>
                            </div>
                          </div>
                        </a>
                      </li>
                    );
                  })}
            </ul>
          </div>
        </div>
      </div>
    );
  },
});

export default withEnvironmentInQueryString(ReleaseOverview);
