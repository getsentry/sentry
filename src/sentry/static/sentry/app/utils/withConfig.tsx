import * as React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {Config} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';
import ConfigStore from 'app/stores/configStore';

type InjectedConfigProps = {
  config: Config;
};

type State = {
  config: Config;
};

/**
 * Higher order component that passes the config object to the wrapped component
 */
const withConfig = <P extends InjectedConfigProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  createReactClass<
    Omit<P, keyof InjectedConfigProps> & Partial<InjectedConfigProps>,
    State
  >({
    displayName: `withConfig(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.listenTo(ConfigStore, 'onUpdate') as any],

    getInitialState() {
      return {config: ConfigStore.getConfig()};
    },

    onUpdate() {
      this.setState({config: ConfigStore.getConfig()});
    },

    render() {
      const {config, ...props} = this.props as P;
      return (
        <WrappedComponent {...({config: config ?? this.state.config, ...props} as P)} />
      );
    },
  });

export default withConfig;
