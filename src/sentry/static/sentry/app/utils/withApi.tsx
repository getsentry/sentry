import React from 'react';

import {Client} from 'app/api';
import getDisplayName from 'app/utils/getDisplayName';

/**
 * HoC that provides "api" client when mounted, and clears API requests when component is unmounted
 */
const withApi = <P extends object>(WrappedComponent: React.ComponentType<P>) => {
  return class extends React.Component<Omit<P, 'api'>> {
    static displayName = `withApi(${getDisplayName(WrappedComponent)})`;

    constructor(props) {
      super(props);
      this.api = new Client();
    }
    componentWillUnmount() {
      this.api.clear();
    }

    private api: Client;

    render() {
      return <WrappedComponent api={this.api} {...this.props as P} />;
    }
  };
};

export default withApi;
