import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import getDisplayName from 'app/utils/getDisplayName';
import SentryAppComponentsStore from 'app/stores/sentryAppComponentsStore';

// TODO(ts): Update when component type is defined
type Component = {};

type InjectedAppComponentsProps = {
  components: Component[];
};

type State = {
  components: Component[];
};

type Options = {
  componentType?: 'stacktrace-link';
};

const withSentryAppComponents = <P extends InjectedAppComponentsProps>(
  WrappedComponent: React.ComponentType<P>,
  {componentType}: Options = {}
) =>
  createReactClass<
    Omit<P, keyof InjectedAppComponentsProps> & Partial<InjectedAppComponentsProps>,
    State
  >({
    displayName: `withSentryAppComponents(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.connect(SentryAppComponentsStore, 'components') as any],

    render() {
      const {
        components = SentryAppComponentsStore.getComponentByType(componentType),
      } = this.props as P;
      return <WrappedComponent {...(this.props as P)} components={components} />;
    },
  });

export default withSentryAppComponents;
