import React from 'react';

import {Client} from 'app/api';
import getDisplayName from 'app/utils/getDisplayName';

type InjectedApiProps = {
  api: Client;
};

type WrappedProps<P> = Omit<P, keyof InjectedApiProps> & Partial<InjectedApiProps>;

/**
 * HoC that provides "api" client when mounted, and clears API requests when
 * component is unmounted
 */
const withApi = <P extends InjectedApiProps>(WrappedComponent: React.ComponentType<P>) =>
  class extends React.Component<WrappedProps<P>> {
    static displayName = `withApi(${getDisplayName(WrappedComponent)})`;

    constructor(props: WrappedProps<P>) {
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

export default withApi;
