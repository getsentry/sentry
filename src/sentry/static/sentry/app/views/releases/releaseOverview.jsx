import React from 'react';
import {Link} from 'react-router';

import LoadingIndicator from '../../components/loadingIndicator';
import LoadingError from '../../components/loadingError';
import IssueList from '../../components/issueList';
import FileChange from '../../components/fileChange';
import CommitAuthorStats from '../../components/commitAuthorStats';
import ReleaseProjectStatSparkline from '../../components/releaseProjectStatSparkline';
import ApiMixin from '../../mixins/apiMixin';

import {t} from '../../locale';


const ReleaseOverview = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      projects: [],
    };
  },

  componentDidMount() {
    let {orgId, projectId, version} = this.props.params;

    let path = `/projects/${orgId}/${projectId}/releases/${version}/commitfiles/`;
    this.api.request(path, {
      method: 'GET',
      data: this.props.location.query,
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          fileList: data,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
    this.getReleaseProjects();
  },

  getReleaseProjects() {
    let {orgId, version} = this.props.params;
    let path = `/organizations/${orgId}/releases/${version}/`;
    this.api.request(path, {
      method: 'GET',
      success: (data, _, jqXHR) => {
        this.setState({
          projects: data.projects,
          error: false,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      }
    });
  },

  render() {
    let {orgId, projectId, version} = this.props.params;

    if (this.state.loading)
      return <LoadingIndicator/>;

    if (this.state.error)
      return <LoadingError/>;

    let {fileList, projects} = this.state;

    // convert list of individual file changes (can be
    // multiple changes to a single file) into a per-file
    // summary
    let fileInfo = fileList.reduce(function (summary, fileChange) {
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

    let fileCount = Object.keys(fileInfo).length;
    return (
      <div>
        <div className="row" style={{paddingTop: 10}}>
          <div className="col-sm-8">
            <h5>{fileCount} Files Changed</h5>
            <ul className="list-group list-group-striped m-b-2">
              {Object.keys(fileInfo).map(file => {
                return (
                  <FileChange
                    key={fileInfo[file].id}
                    filename={file}
                    authors={Object.values(fileInfo[file].authors)}
                    types={fileInfo[file].types}
                    />
                );
              })}
            </ul>

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
          </div>
          <div className="col-sm-4">
            <CommitAuthorStats
              orgId={orgId}
              projectId={projectId}
              version={version}
            />
            <h6 className="nav-header m-b-1">Other Projects Affected</h6>
            <ul className="nav nav-stacked">
            {projects.map((project) => {
              return (
                <li key={project.id}>
                  <div className="sparkline pull-right" style={{width: 96}}>
                    <ReleaseProjectStatSparkline orgId={orgId} projectId={project.slug} />
                  </div>
                  <Link to={`/${orgId}/${project.slug}/`}>
                    <h6 className="m-b-0">
                      {project.name}
                    </h6>
                    <p className="m-b-0">12 events</p>
                  </Link>
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
