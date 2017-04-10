import React from 'react';
import {Link} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import countryCodes from '../utils/countryCodes';
import GeoMap from '../components/geoMap';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';

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
    let {orgId, projectId} = this.props.params;
    return `/projects/${orgId}/${projectId}/locations/`;
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

    let series = this.state.data.map(tag => [countryCodes[tag.value], tag.count]);
    let {highlight} = this.props.location.query;
    if (highlight) {
      highlight = countryCodes[highlight];
    }
    return <GeoMap highlightCountryCode={highlight} series={series}/>;
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
    let {orgId, projectId} = this.props.params;
    return `/projects/${orgId}/${projectId}/users/`;
  },

  getDisplayName(user) {
    return (
      user.username ||
      user.email ||
      user.identifier ||
      `${user.ipAddress} (anonymous)`
    );
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

    let {orgId, projectId} = this.props.params;
    return (
      <div>
        <LocationsMap {...this.props} />
        <ul>
          {this.state.data.map((user) => {
            let link = `/${orgId}/${projectId}/audience/users/${user.hash}/`;
            return (
              <li key={user.id}>
                <img src={user.avatarUrl} />
                <Link to={link}>{this.getDisplayName(user)}</Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  },
});
