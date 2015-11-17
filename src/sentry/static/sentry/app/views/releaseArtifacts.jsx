import React from 'react';
import {History} from 'react-router';

import api from '../api';
import FileSize from '../components/fileSize';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Pagination from '../components/pagination';

const ReleaseArtifacts = React.createClass({
  contextTypes: {
    release: React.PropTypes.object
  },

  mixins: [ History ],

  getInitialState() {
    return {
      loading: true,
      error: false,
      fileList: [],
      pageLinks: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentDidUpdate(prevProps) {
    if (this.props.location.search !== prevProps.location.search) {
      this.fetchData();
    }
  },

  fetchData() {
    let params = this.props.params;
    let endpoint = '/projects/' + params.orgId + '/' + params.projectId + '/releases/' + params.version + '/files/';

    this.setState({
      loading: true,
      error: false
    });

    api.request(endpoint, {
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

  render() {
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;
    else if (this.state.fileList.length === 0)
      return (
        <div className="box empty-stream">
          <span className="icon icon-exclamation"></span>
          <p>There are no artifacts uploaded for this release.</p>
        </div>
      );

    // TODO(dcramer): files should allow you to download and delete them
    return (
      <div>
        <table className="table">
          <tbody>
          {this.state.fileList.map((file) => {
            return (
              <tr key={file.id}>
                <td><strong>{file.name}</strong></td>
                <td style={{width: 120}}><FileSize bytes={file.size} /></td>
              </tr>
            );
          })}
          </tbody>
        </table>
        <Pagination pageLinks={this.state.pageLinks}/>
      </div>
    );
  }
});

export default ReleaseArtifacts;
