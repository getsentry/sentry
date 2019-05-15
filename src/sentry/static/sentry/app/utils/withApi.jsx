import React from 'react';

import {Client} from 'app/api';
import getDisplayName from 'app/utils/getDisplayName';

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
      const {['data-test-id']: _, ...props} = this.props;

      return <WrappedComponent api={this.api} {...props} />;
    }
  }

  WithApi.displayName = `withApi(${getDisplayName(WrappedComponent)})`;

  return WithApi;
};

export default withApi;
