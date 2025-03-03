import {Component} from 'react';

import SentryAppComponentsStore from 'sentry/stores/sentryAppComponentsStore';
import type {SentryAppComponent} from 'sentry/types/integrations';
import getDisplayName from 'sentry/utils/getDisplayName';

type InjectedAppComponentsProps = {
  components: SentryAppComponent[];
};

type State = {
  components: SentryAppComponent[];
};

type Options = {
  componentType?: SentryAppComponent['type'];
};

function withSentryAppComponents<P extends InjectedAppComponentsProps>(
  WrappedComponent: React.ComponentType<P>,
  {componentType}: Options = {}
) {
  class WithSentryAppComponents extends Component<
    Omit<P, keyof InjectedAppComponentsProps> & Partial<InjectedAppComponentsProps>,
    State
  > {
    static displayName = `withSentryAppComponents(${getDisplayName(WrappedComponent)})`;

    state = {components: SentryAppComponentsStore.getAll()};

    componentWillUnmount() {
      this.unsubscribe();
    }

    unsubscribe = SentryAppComponentsStore.listen(
      () => this.setState({components: SentryAppComponentsStore.getAll()}),
      undefined
    );

    render() {
      const {components: propComponents, ...props} = this.props as P;

      const storeComponents = componentType
        ? this.state.components.filter(item => item.type === componentType)
        : this.state.components;

      const components = propComponents ?? storeComponents;

      // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
      return <WrappedComponent {...({components, ...props} as P as any)} />;
    }
  }
  return WithSentryAppComponents;
}

export default withSentryAppComponents;
