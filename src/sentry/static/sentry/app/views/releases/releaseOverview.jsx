import React from 'react';

import LoadingIndicator from '../../components/loadingIndicator';
import LoadingError from '../../components/loadingError';
import IssueList from '../../components/issueList';
import FileChange from '../../components/fileChange';
import CommitAuthorStats from '../../components/commitAuthorStats';
import ReleaseProjectStatSparkline from '../../components/releaseProjectStatSparkline';
import TimeSince from '../../components/timeSince';

import ApiMixin from '../../mixins/apiMixin';

import {t} from '../../locale';

function Collapsed(props) {
  return (
    <li className="list-group-item list-group-item-sm align-center">
      <span className="icon-container">
      </span>
      <a onClick={props.onClick}>Show {props.count} collapsed files</a>
    </li>
  );
}

Collapsed.propTypes = {
  onClick: React.PropTypes.func.isRequired,
  count: React.PropTypes.number.isRequired
};

const ReleaseOverview = React.createClass({

  mixins: [ApiMixin],

  statics: {
    MAX_WHEN_COLLAPSED: 5
  },

  getInitialState() {
    return {
      loading: true,
      error: false,
      projects: [],
      fileList: [],
      collapsed: true,
      deploys: [],
      hasRepos: false,
    };
  },

  componentDidMount() {
    let {orgId, version} = this.props.params;

    let path = `/organizations/${orgId}/releases/${version}/commitfiles/`;
    this.api.request(path, {
      method: 'GET',
      data: this.props.location.query,
      success: (data, _, jqXHR) => {
        this.setState({
          fileList: data,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      }
    });
    this.getReleaseProjects();
    this.getDeploys();
    this.getRepos();
  },

  getReleaseProjects() {
    let {orgId, version} = this.props.params;
    let path = `/organizations/${orgId}/releases/${version}/`;
    this.api.request(path, {
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
      }
    });
  },

  getDeploys() {
    let {orgId, version} = this.props.params;
    let path = `/organizations/${orgId}/releases/${version}/deploys/`;
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
          hasRepos: data.length > 0,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      }
    });
  },

  renderEmpty() {
    return <div className="box empty">{t('None')}</div>;
  },

  onCollapseToggle() {
    this.setState({
      collapsed: !this.state.collapsed
    });
  },

  render() {
    let {orgId, projectId, version} = this.props.params;

    if (this.state.loading)
      return <LoadingIndicator/>;

    if (this.state.error)
      return <LoadingError/>;

    let {fileList, projects, hasRepos} = this.state;

    // convert list of individual file changes (can be
    // multiple changes to a single file) into a per-file
    // summary
    let fileChangeSummary = fileList.reduce(function (summary, fileChange) {
      let {author, type, filename} = fileChange;
      if (!summary.hasOwnProperty(filename)) {
        summary[filename] = {
          authors: {}, types: new Set()
        };
      }

      summary[filename].authors[author.email] = author;
      summary[filename].types.add(type);

      return summary;
    }, {});

    let fileCount = Object.keys(fileChangeSummary).length;

    const MAX = ReleaseOverview.MAX_WHEN_COLLAPSED;

    let files = Object.keys(fileChangeSummary);
    files.sort();
    if (this.state.collapsed && fileCount > MAX) {
      files = files.slice(0, MAX);
    }
    let numCollapsed = fileCount - files.length;
    let deploys = this.state.deploys;
    return (
      <div>
        <div className="row" style={{paddingTop: 10}}>
          <div className="col-sm-8">
            <h5>{t('Issues Resolved in this Release')}</h5>
            <IssueList
              endpoint={`/projects/${orgId}/${projectId}/releases/${version}/resolved/`}
              pagination={false}
              renderEmpty={() => <div className="box empty m-b-2" key="none">{t('No issues resolved')}</div>}
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
                limit: 5,
              }}
              statsPeriod="0"
              pagination={false}
              renderEmpty={() => <div className="box empty m-b-2" key="none">{t('No new issues')}</div>}
              ref="issueList"
              showActions={false}
              params={{orgId: orgId}}
              className="m-b-2"
              />
            {hasRepos &&
              <div>
                <h5>{fileCount} Files Changed</h5>
                <ul className="list-group list-group-striped m-b-2">
                  {files.map(filename => {
                    return (
                      <FileChange
                        key={fileChangeSummary[filename].id}
                        filename={filename}
                        authors={Object.values(fileChangeSummary[filename].authors)}
                        types={fileChangeSummary[filename].types}
                        />
                    );
                  })}
                  {numCollapsed > 0 && <Collapsed onClick={this.onCollapseToggle} count={numCollapsed}/>}
                </ul>
              </div>
            }
          </div>
          <div className="col-sm-4">
            { hasRepos ?
              <div>
                <CommitAuthorStats
                  orgId={orgId}
                  projectId={projectId}
                  version={version}
                />
                <h6 className="nav-header m-b-1">Other Projects Affected</h6>
                <ul className="nav nav-stacked">
                { projects.length === 1 ? this.renderEmpty() :
                  projects.map((project) => {
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
                  })
                }
                </ul>
              </div>
              :
              <div className="well blankslate m-t-2 m-b-2 p-x-2 p-t-1 p-b-2 align-center">
                <span className="icon icon-git-commit" />
                <h5>Releases are better with commit data!</h5>
                <p>Connect a repository to see commit info, files changed, and authors involved in future releases.</p>
                <a className="btn btn-primary"
                  href={`/organizations/${orgId}/repos/`}>
                  Connect a repository
                </a>
              </div>
            }
            <h6 className="nav-header m-b-1">{t('Deploys')}</h6>
            <ul className="nav nav-stacked">
              { !deploys.length ? this.renderEmpty() :
                deploys.map(deploy => {
                  let query = encodeURIComponent(`environment:${deploy.environment} release:${version}`);
                  return (
                    <li key={deploy.id}>
                      <a href={`/${orgId}/${projectId}/?query=${query}`}>
                        <div className="row row-flex row-center-vertically">
                          <div className="col-xs-6">
                            <span className="repo-label" style={{verticalAlign: 'bottom'}}>{deploy.environment}</span>
                            <small><span className="icon-open" style={{opacity: '.4', paddingLeft: 8}} /></small>
                          </div>
                          <div className="col-xs-6 align-right">
                            <small><TimeSince date={deploy.dateFinished}/></small>
                          </div>
                        </div>
                      </a>
                    </li>
                  );
                })
              }
            </ul>
          </div>
        </div>
      </div>
    );
  }
});

export default ReleaseOverview;
