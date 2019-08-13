import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import getDisplayName from 'app/utils/getDisplayName';
import SentryAppComponentsStore from 'app/stores/sentryAppComponentsStore';

type Options = {
  componentType?: 'stacktrace-link';
};

// TODO(ts): Update when component type is defined
type Component = {};

const withSentryAppComponents = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  {componentType}: Options = {}
) =>
  createReactClass({
    displayName: `withSentryAppComponents(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.connect(SentryAppComponentsStore, 'components')],

    render() {
      return (
        <WrappedComponent
          components={
            SentryAppComponentsStore.getComponentByType(componentType) as Component[]
          }
          {...this.props as P}
        />
      );
    },
  });

export default withSentryAppComponents;
