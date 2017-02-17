import React from 'react';

import LoadingIndicator from '../../components/loadingIndicator';
import LoadingError from '../../components/loadingError';

import FileChange from '../../components/fileChange';

import ApiMixin from '../../mixins/apiMixin';

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

    if (this.state.loading)
      return <LoadingIndicator/>;

    if (this.state.error)
      return <LoadingError/>;

    let {fileList} = this.state;

    if (!fileList.length)
      return <this.emptyState/>;

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
      <div className="panel panel-default">
        <b>{fileCount} Files Changed</b>
        <ul className="crumbs">
          {Object.keys(fileInfo).map(file => {
            return (
              <FileChange
                key={file}
                filename={file}
                authors={fileInfo[file].authors}
                types={fileInfo[file].types}
                />
            );
          })}
        </ul>
      </div>
    );
  }
});

export default ReleaseOverview;