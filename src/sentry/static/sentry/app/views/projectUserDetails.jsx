import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import GeoMap from '../components/geoMap_MapBox';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import IssueList from '../components/issueList';

const UserActivity = React.createClass({
  propTypes: {
    user: React.PropTypes.object.isRequired,
  },

  getEndpoint() {
    let {params, user} = this.props;
    return `/organizations/${params.orgId}/users/${user.id}/issues/`;
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

const LocationsMap = React.createClass({
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
    return `/projects/${orgId}/${projectId}/users/${userId}/locations/`;
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  render() {
    if (this.state.loading)
      return this.renderLoading();
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    return <GeoMap series={this.state.data} height={600} />;
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
        <div className="row">
          <div className="col-md-4">
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
          </div>
          <div className="col-md-8">
            <LocationsMap {...this.props} />
          </div>
        </div>
        <UserActivity {...this.props} user={data} />
      </div>
    );
  },
});
