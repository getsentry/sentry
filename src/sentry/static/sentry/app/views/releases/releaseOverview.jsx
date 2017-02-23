import React from 'react';

import LoadingIndicator from '../../components/loadingIndicator';
import LoadingError from '../../components/loadingError';
import IssueList from '../../components/issueList';
import FileChange from '../../components/fileChange';
import CommitAuthorStats from '../../components/commitAuthorStats';
import ApiMixin from '../../mixins/apiMixin';

import {t} from '../../locale';

const ReleaseOverview = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
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
  },

  emptyState() {
    return(
      <div className="box empty-stream m-y-0">
        <span className="icon icon-exclamation" />
        <p>There are no commits associated with this release.</p>
        {/* Todo: Should we link to repo settings from here?  */}
      </div>
    );
  },

  render() {
    let {orgId, projectId, version} = this.props.params;

    if (this.state.loading)
      return <LoadingIndicator/>;

    if (this.state.error)
      return <LoadingError/>;

    let {fileList} = this.state;

    // if (!fileList.length)
    //   return <this.emptyState/>;

    let fileInfo = {};

    for (let i = 0; i < fileList.length; i++) {
      if (!fileInfo[fileList[i].filename]) {
        fileInfo[fileList[i].filename] = {
          authors: new Set([fileList[i].author]),
          types: new Set([fileList[i].type])
        };
      }
      else {
        fileInfo[fileList[i].filename].authors.add(fileList[i].author);
        fileInfo[fileList[i].filename].types.add(fileList[i].type);
      }
    }
    let fileCount = Object.keys(fileInfo).length;

    return (
      <div>
        <div className="row">
          <div className="com-sm-6">
            <b>{t('New Issues in this Release')}</b>
            <IssueList
              endpoint={`/projects/${orgId}/${projectId}/issues/`}
              query={{
                query: 'first-release:"' + version + '"',
                limit: 5,
              }}
              statsPeriod="0"
              pagination={true}
              renderEmpty={() => <div className="sidebar-panel-empty" key="none">{t('No issues')}</div>}
              ref="issueList"
              showActions={false}
              params={{orgId: orgId}} />
          </div>
          <div className="com-sm-6">
            <b>{t('Issues Resolved in this Release')}</b>
            <IssueList
              endpoint={`/projects/${orgId}/${projectId}/releases/${version}/resolved/`}
              pagination={true}
              renderEmpty={() => <div className="sidebar-panel-empty" key="none">{t('No issues')}</div>}
              ref="issueList"
              showActions={false}
              params={{orgId: orgId}} />
            </div>
        </div>
        <div className="row panel panel-default">
        <div className="col-sm-9">
          <b>{fileCount} Files Changed</b>
          <ul className="crumbs">
            {Object.keys(fileInfo).map(file => {
              return (
                <FileChange
                  key={fileInfo[file].id}
                  filename={file}
                  authors={fileInfo[file].authors}
                  types={fileInfo[file].types}
                  />
              );
            })}
          </ul>
        </div>
        <CommitAuthorStats
          orgId={orgId}
          projectId={projectId}
          version={version}
        />
        </div>
      </div>
    );
  }
});

export default ReleaseOverview;