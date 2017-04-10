import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import IssueList from '../components/issueList';

const UserActivity = React.createClass({
  getEndpoint() {
    let {orgId, userId} = this.props.params;
    return `/organizations/${orgId}/users/${userId}/issues/`;
  },

  render() {
    return (
      <div>
        <h4>Activity</h4>
        <IssueList
          endpoint={this.getEndpoint()}
          {...this.props} />
      </div>
    );
  },
});

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
    if (this.state.loading)
      return this.renderLoading();
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let {data} = this.state;

    return (
      <div>
        <h4>{this.getDisplayName(data)}</h4>
        <dl>
          <dt>ID:</dt>
          <dd>{data.id || <em>n/a</em>}</dd>
          <dt>Username:</dt>
          <dd>{data.username || <em>n/a</em>}</dd>
          <dt>Email:</dt>
          <dd>{data.email || <em>n/a</em>}</dd>
          <dt>IP Address:</dt>
          <dd>{data.ipAddress || <em>n/a</em>}</dd>
        </dl>
        <UserActivity {...this.props} />
      </div>
    );
  },
});
