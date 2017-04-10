import jQuery from 'jquery';
import React from 'react';
import {browserHistory} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {t} from '../locale';

export default React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getEndpoint(), {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          data: data,
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

  getEndpoint() {
    let {orgId, projectId, userId} = this.props.params;
    return `/projects/${orgId}/${projectId}/users/${userId}/`;
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  getDisplayName(user) {
    return (
      user.username ||
      user.email ||
      user.identifier ||
      `${user.ipAddress} (anonymous)`
    );
  },

  render() {
    let params = this.props.params;

    if (this.state.loading)
      return this.renderLoading();
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let {data} = this.state;

    return (
      <h4>{this.getDisplayName(data)}</h4>
    );
  },
});
