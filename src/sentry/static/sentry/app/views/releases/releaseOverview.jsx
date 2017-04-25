import React from 'react';

import LoadingIndicator from '../../components/loadingIndicator';
import LoadingError from '../../components/loadingError';
import IconOpen from '../../icons/icon-open';
import LastCommit from '../../components/lastCommit';
import IssueList from '../../components/issueList';
import CommitAuthorStats from '../../components/commitAuthorStats';
import ReleaseProjectStatSparkline from '../../components/releaseProjectStatSparkline';
import RepositoryFileSummary from '../../components/repositoryFileSummary';
import TimeSince from '../../components/timeSince';

import ApiMixin from '../../mixins/apiMixin';

import {t} from '../../locale';

const ReleaseOverview = React.createClass({
  contextTypes: {
    release: React.PropTypes.object
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      projects: [],
      fileList: [],
      deploys: [],
      hasRepos: false
    };
  },

  componentDidMount() {
    let {orgId, version} = this.props.params;

    let path = `/organizations/${orgId}/releases/${encodeURIComponent(version)}/commitfiles/`;
    this.api.request(path, {
      method: 'GET',
      data: this.props.location.query,
      success: (data, _, jqXHR) => {
        this.setState({
          fileList: data
        });
      },
      error: () => {
        this.setState({
          error: true
        });
      }
    });
    this.getReleaseProjects();
    this.getDeploys();
    this.getRepos();
  },

  getReleaseProjects() {
    let {orgId, version} = this.props.params;
    let path = `/organizations/${orgId}/releases/${encodeURIComponent(version)}/`;
    this.api.request(path, {
      method: 'GET',
      success: (data, _, jqXHR) => {
        this.setState({
          projects: data.projects
        });
      },
      error: () => {
        this.setState({
          error: true
        });
      }
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
          loading: false
        });
      },
      error: () => {
        this.setState({
          error: true
        });
      }
    });
  },

  getRepos() {
    let {orgId} = this.props.params;
    let path = `/organizations/${orgId}/repos/`;
    this.api.request(path, {
      method: 'GET',
      success: (data, _, jqXHR) => {
        this.setState({
          hasRepos: data.length > 0
        });
      },
      error: () => {
        this.setState({
          error: true
        });
      }
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
          repos: new Set()
        };
      }

      fbr[repoName][filename].authors[author.email] = author;
      fbr[repoName][filename].types.add(type);

      return fbr;
    }, {});

    let deploys = this.state.deploys;
    return (
      <div>
        <div className="row" style={{paddingTop: 10}}>
          <div className="col-sm-8">
            <h5>{t('Issues Resolved in this Release')}</h5>
            <IssueList
              endpoint={`/projects/${orgId}/${projectId}/releases/${encodeURIComponent(version)}/resolved/`}
              pagination={false}
              renderEmpty={() => (
                <div className="box empty m-b-2" key="none">
                  {t('No issues resolved')}
                </div>
              )}
              ref="issueList"
              showActions={false}
              params={{orgId: orgId}}
              className="m-b-2"
            />
            <h5>{t('New Issues in this Release')}</h5>
            <IssueList
              endpoint={`/projects/${orgId}/${projectId}/issues/`}
              query={{
                query: 'first-release:"' + version + '"',
                limit: 5
              }}
              statsPeriod="0"
              pagination={false}
              renderEmpty={() => (
                <div className="box empty m-b-2" key="none">{t('No new issues')}</div>
              )}
              ref="issueList"
              showActions={false}
              params={{orgId: orgId}}
              className="m-b-2"
            />
            {hasRepos &&
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
              </div>}
          </div>
          <div className="col-sm-4">
            {hasRepos
              ? <div>
                  {lastCommit &&
                    <LastCommit lastCommit={lastCommit} headerClass="nav-header" />}
                  <CommitAuthorStats
                    orgId={orgId}
                    projectId={projectId}
                    version={version}
                  />
                  <h6 className="nav-header m-b-1">Other Projects Affected</h6>
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
              : <div className="well blankslate m-t-2 m-b-2 p-x-2 p-t-1 p-b-2 align-center">
                  <span className="icon icon-git-commit" />
                  <h5>Releases are better with commit data!</h5>
                  <p>
                    Connect a repository to see commit info, files changed, and authors involved in future releases.
                  </p>
                  <a className="btn btn-primary" href={`/organizations/${orgId}/repos/`}>
                    Connect a repository
                  </a>
                </div>}
            <h6 className="nav-header m-b-1">{t('Deploys')}</h6>
            <ul className="nav nav-stacked">
              {!deploys.length
                ? this.renderEmpty()
                : deploys.map(deploy => {
                    let query = encodeURIComponent(
                      `environment:${deploy.environment} release:${version}`
                    );
                    return (
                      <li key={deploy.id}>
                        <a
                          href={`/${orgId}/${projectId}/?query=${query}`}
                          title={t('View in stream')}>
                          <div className="row row-flex row-center-vertically">
                            <div className="col-xs-6">
                              <span
                                className="repo-label"
                                style={{verticalAlign: 'bottom'}}>
                                {deploy.environment}
                                <IconOpen
                                  className="icon-open"
                                  size={11}
                                  style={{marginLeft: 6}}
                                />
                              </span>
                            </div>
                            <div className="col-xs-6 align-right">
                              <small><TimeSince date={deploy.dateFinished} /></small>
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
  }
});

export default ReleaseOverview;
