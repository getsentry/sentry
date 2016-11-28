import React from 'react';
import {History} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Pagination from '../components/pagination';

import {t} from '../locale';

const ReleaseCommits = React.createClass({
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

  getCommitsEndpoint() {
    let params = this.props.params;
    return `/projects/${params.orgId}/${params.projectId}/releases/${params.version}/commits/`;
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getCommitsEndpoint(), {
      method: 'GET',
      data: this.props.location.query,
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          commitList: data,
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
    else if (this.state.commitList.length === 0)
      return (
        <div className="box empty-stream">
          <span className="icon icon-exclamation"></span>
          <p>{t('There is no commit log associated with this release.')}</p>
        </div>
      );

    // TODO(dcramer): files should allow you to download them
    return (
      <div>
        <div className="release-list">
        {this.state.commitList.map((commit) => {
          return (
            <div className="release" key={commit.id}>
              <div className="pull-right">
                <small>{commit.shortId}</small>
              </div>
              {commit.title &&
                <div><strong>{commit.title}</strong></div>
              }
              <small>{commit.author ? commit.author.name : <em>unknown author</em>}</small>
            </div>
          );
        })}
        </div>
        <Pagination pageLinks={this.state.pageLinks}/>
      </div>
    );
  }
});

export default ReleaseCommits;
