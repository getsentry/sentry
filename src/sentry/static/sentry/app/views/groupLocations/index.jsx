import React from 'react';

import ApiMixin from '../../mixins/apiMixin';

import GeoMap from '../../components/geoMap_MapBox';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';

export default React.createClass({
  mixins: [
    ApiMixin,
  ],

  getInitialState() {
    return {
      loading: true,
      error: false,
      data: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    let url = `/issues/${this.props.params.groupId}/locations/`;
    this.setState({
      loading: true,
      error: false
    });

    this.api.request(url, {
      success: (data, _, jqXHR) => {
        this.setState({
          data: data,
          error: false,
          loading: false
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
      return <LoadingIndicator/>;
    if (this.state.error)
      return <LoadingError/>;

    return <GeoMap series={this.state.data}/>;
  }
});
