import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import getDisplayName from 'app/utils/getDisplayName';
import ConfigStore from 'app/stores/configStore';

/**
 * Higher order component that passes the config object to the wrapped component
 */
const withConfig = <P extends object>(WrappedComponent: React.ComponentType<P>) =>
  createReactClass({
    displayName: `withConfig(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.listenTo(ConfigStore, 'onUpdate')],
    getInitialState() {
      return {
        config: ConfigStore.getConfig(),
      };
    },

    onUpdate() {
      this.setState({
        config: ConfigStore.getConfig(),
      });
    },

    render() {
      return (
        <WrappedComponent config={this.state.config as object} {...this.props as P} />
      );
    },
  });

export default withConfig;
