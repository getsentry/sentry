import * as React from 'react';

import ConfigStore from 'app/stores/configStore';
import {Config} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';

type InjectedConfigProps = {
  config: Config;
};

type State = {
  config: Config;
};

/**
 * Higher order component that passes the config object to the wrapped component
 */
function withConfig<P extends InjectedConfigProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithConfig extends React.Component<
    Omit<P, keyof InjectedConfigProps> & Partial<InjectedConfigProps>,
    State
  > {
    static displayName = `withConfig(${getDisplayName(WrappedComponent)})`;

    state = {config: ConfigStore.getConfig()};

    componentWillUnmount() {
      this.unsubscribe();
    }

    unsubscribe = ConfigStore.listen(
      () => this.setState({config: ConfigStore.getConfig()}),
      undefined
    );

    render() {
      const {config, ...props} = this.props as P;
      return (
        <WrappedComponent {...({config: config ?? this.state.config, ...props} as P)} />
      );
    }
  }

  return WithConfig;
}

export default withConfig;
