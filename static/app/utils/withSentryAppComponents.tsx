import * as React from 'react';

import SentryAppComponentsStore from 'app/stores/sentryAppComponentsStore';
import {SentryAppComponent} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';

type InjectedAppComponentsProps = {
  components: SentryAppComponent[];
};

type State = {
  components: SentryAppComponent[];
};

type Options = {
  componentType?: 'stacktrace-link';
};

function withSentryAppComponents<P extends InjectedAppComponentsProps>(
  WrappedComponent: React.ComponentType<P>,
  {componentType}: Options = {}
) {
  class WithSentryAppComponents extends React.Component<
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
      const {components, ...props} = this.props as P;
      return (
        <WrappedComponent
          {...({
            components:
              components ?? SentryAppComponentsStore.getComponentByType(componentType),
            ...props,
          } as P)}
        />
      );
    }
  }
  return WithSentryAppComponents;
}

export default withSentryAppComponents;
