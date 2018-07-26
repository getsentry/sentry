import React from 'react';

import {Client} from 'app/api';
import {getDisplayName} from 'app/utils/getDisplayName';

/**
 * HoC that provides "api" client when mounted, and clears API requests when component is unmounted
 */
const withApi = WrappedComponent => {
  class WithApi extends React.Component {
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
  }

  WithApi.displayName = `withApi(${getDisplayName(WrappedComponent)})`;

  return WithApi;
};

export default withApi;
