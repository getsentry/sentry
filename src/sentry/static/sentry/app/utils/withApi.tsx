import * as React from 'react';

import {Client} from 'app/api';
import getDisplayName from 'app/utils/getDisplayName';

type InjectedApiProps = {
  api: Client;
};

type WrappedProps<P> = Omit<P, keyof InjectedApiProps> & Partial<InjectedApiProps>;

type OptionProps = {
  /**
   * Enabling this option will disable clearing in-flight requests when the
   * component is unmounted.
   *
   * This may be useful in situations where your component needs to finish up
   * some where the client was passed into some type of action creator and the
   * component is unmounted.
   */
  persistInFlight?: boolean;
};

/**
 * HoC that provides "api" client when mounted, and clears API requests when
 * component is unmounted
 */
const withApi = <P extends InjectedApiProps>(
  WrappedComponent: React.ComponentType<P>,
  {persistInFlight}: OptionProps = {}
) =>
  (class extends React.Component<WrappedProps<P>> {
    static displayName = `withApi(${getDisplayName(WrappedComponent)})`;

    constructor(props: WrappedProps<P>) {
      super(props);
      this.api = new Client();
    }

    componentWillUnmount() {
      if (!persistInFlight) {
        this.api.clear();
      }
    }

    private api: Client;

    render() {
      const {api, ...props} = this.props;
      return <WrappedComponent {...({api: api ?? this.api, ...props} as P)} />;
    }
  });

export default withApi;
