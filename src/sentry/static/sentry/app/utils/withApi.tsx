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

    // TODO(ts): Update this when API client is typed
    private api: any;

    render() {
      return <WrappedComponent api={this.api as any} {...this.props as P} />;
    }
  };
};

export default withApi;
