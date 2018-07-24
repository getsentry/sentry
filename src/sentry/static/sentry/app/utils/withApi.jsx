import React from 'react';

import {Client} from 'app/api';

/**
 * HoC that provides "api" client when mounted, and clears API requests when component is unmounted
 */
const withApi = WrappedComponent =>
  class extends React.Component {
    constructor(props) {
      super(props);
      this.api = new Client();
    }
    componentWillUnmount() {
      this.api.clear();
    }
    render() {
      return <WrappedComponent api={this.api} {...this.props} />;
    }
  };

export default withApi;
