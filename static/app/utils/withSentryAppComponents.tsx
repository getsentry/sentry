import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import SentryAppComponentsStore from 'app/stores/sentryAppComponentsStore';
import getDisplayName from 'app/utils/getDisplayName';

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
    },
  });

export default withSentryAppComponents;
