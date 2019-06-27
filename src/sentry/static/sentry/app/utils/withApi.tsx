import React from 'react';

import {Client} from 'app/api';
import getDisplayName from 'app/utils/getDisplayName';

/**
 * HoC that provides "api" client when mounted, and clears API requests when component is unmounted
 */
const withApi = <WrappedComponentPropType extends {}>(
  WrappedComponent: React.ComponentType<WrappedComponentPropType>
) => {
  class WithApi extends React.Component<WrappedComponentPropType> {
    static displayName: string;

    api?: Client = void 0;

    constructor(props: WrappedComponentPropType) {
      super(props);
      this.api = new Client();
    }
    componentWillUnmount() {
      if (this.api) {
        this.api.clear();
      }
    }
    render() {
      return <WrappedComponent api={this.api} {...this.props} />;
    }
  }

  WithApi.displayName = `withApi(${getDisplayName(WrappedComponent)})`;

  return WithApi;
};

export default withApi;
