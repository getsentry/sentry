import React from 'react';
import {History} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import GroupState from '../mixins/groupState';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Pagination from '../components/pagination';
import {t} from '../locale';

const GroupHashes = React.createClass({
  mixins: [
    ApiMixin,
    GroupState,
    History
  ],

  getInitialState() {
    return {
      hashList: [],
      loading: true,
      error: false,
      pageLinks: '',
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.params.groupId !== this.props.params.groupId) {
      this.setState({
        hashList: [],
        loading: true,
        error: false,
      }, this.fetchData);
    }
  },

  getEndpoint() {
    let params = this.props.params;
    let queryParams = {
      ...this.props.location.query,
      limit: 50,
    };

    return `/issues/${params.groupId}/hashes/?${jQuery.param(queryParams)}`;
  },

  fetchData() {
    let queryParams = this.props.location.query;

    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getEndpoint(), {
      method: 'GET',
      data: queryParams,
      success: (data, _, jqXHR) => {
        this.setState({
          hashList: data,
          error: false,
          loading: false,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: (error) => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('There don\'t seem to be any hashes for this issue.')}</p>
      </div>
    );
  },

  renderResults() {
    let children = this.state.hashList.map((hash) => {
      return (
        <tr key={hash.id}>
          <td>
            <h5>{hash.id}</h5>
          </td>
        </tr>
      );
    });

    return (
      <div>
        <table className="table">
          <thead>
            <tr>
              <th>{t('ID')}</th>
            </tr>
          </thead>
          <tbody>
            {children}
          </tbody>
        </table>
        <Pagination pageLinks={this.state.pageLinks}/>
      </div>
    );
  },

  renderBody() {
    let body;

    if (this.state.loading)
      body = <LoadingIndicator />;
    else if (this.state.error)
      body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.hashList.length > 0)
      body = this.renderResults();
    else
      body = this.renderEmpty();

    return body;
  },

  render() {
    return this.renderBody();
  }
});

export default GroupHashes;
