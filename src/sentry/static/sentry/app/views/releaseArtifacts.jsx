import React from 'react';
import {History} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import FileSize from '../components/fileSize';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import IndicatorStore from '../stores/indicatorStore';
import Pagination from '../components/pagination';
import LinkWithConfirmation from '../components/linkWithConfirmation';

import {t} from '../locale';

const ReleaseArtifacts = React.createClass({
  contextTypes: {
    release: React.PropTypes.object
  },

  mixins: [
    ApiMixin,
    History
  ],

  getInitialState() {
    return {
      loading: true,
      error: false,
      fileList: [],
      pageLinks: null
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  componentDidUpdate(prevProps) {
    if (this.props.location.search !== prevProps.location.search) {
      this.fetchData();
    }
  },

  getFilesEndpoint() {
    let params = this.props.params;
    return `/projects/${params.orgId}/${params.projectId}/releases/${params.version}/files/`;
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getFilesEndpoint(), {
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

  handleRemove(id) {
    let loadingIndicator = IndicatorStore.add(t('Removing artifact..'));

    this.api.request(this.getFilesEndpoint() + `${id}/`, {
      method: 'DELETE',
      success: () => {
        let fileList = this.state.fileList.filter((file) => {
          return file.id !== id;
        });

        this.setState({
          fileList: fileList
        });

        IndicatorStore.add(t('Artifact removed.'), 'success', {
          duration: 4000
        });
      },
      error: () => {
        IndicatorStore.add(t('Unable to remove artifact. Please try again.'), 'error', {
          duration: 4000
        });
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
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
          <p>{t('There are no artifacts uploaded for this release.')}</p>
        </div>
      );

    // TODO(dcramer): files should allow you to download them
    return (
      <div>
        <div className="release-group-header">
          <div className="row">
            <div className="col-sm-9 col-xs-8">{'Name'}</div>
            <div className="col-sm-2 col-xs-2 align-right">{'Size'}</div>
            <div className="col-sm-1 col-xs-2 align-right"></div>
          </div>
        </div>
        <div className="release-list">
        {this.state.fileList.map((file) => {
          return (
            <div className="release release-artifact row" key={file.id}>
              <div className="col-sm-9 col-xs-8" style={{wordWrap: 'break-word'}}><strong>{file.name || '(empty)'}</strong></div>
              <div className="col-sm-2 col-xs-2 align-right"><FileSize bytes={file.size} /></div>
              <div className="col-sm-1 col-xs-2 align-right">
                <LinkWithConfirmation
                  className="btn btn-sm btn-default"
                  title={t('Delete artifact')}
                  message={t('Are you sure you want to remove this artifact?')}
                  onConfirm={this.handleRemove.bind(this, file.id)}>

                  <span className="icon icon-trash" />
                </LinkWithConfirmation>
              </div>
            </div>
          );
        })}
        </div>
        <Pagination pageLinks={this.state.pageLinks}/>
      </div>
    );
  }
});

export default ReleaseArtifacts;
