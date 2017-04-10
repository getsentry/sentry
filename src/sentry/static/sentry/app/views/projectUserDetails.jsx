import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import GeoMap from '../components/geoMap';
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

const UserLocation = React.createClass({
  propTypes: {
    user: React.PropTypes.object.isRequired,
  },

  render() {
    let {user} = this.props;
    if (!user.location)
      return null;

    let series = [[user.location, 1]];
    return (
      <div>
        <h4>Where am I?</h4>
        <GeoMap highlightCountryCode={user.location} series={series}/>
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
        <UserLocation {...this.props} user={data} />
        <UserActivity {...this.props} user={data} />
      </div>
    );
  },
});
