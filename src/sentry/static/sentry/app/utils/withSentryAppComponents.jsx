import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import getDisplayName from 'app/utils/getDisplayName';
import SentryAppComponentsStore from 'app/stores/sentryAppComponentsStore';

const withSentryAppComponents = type => WrappedComponent =>
  createReactClass({
    displayName: `withSentryAppComponents(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.connect(SentryAppComponentsStore, 'components')],

    render() {
      return (
        <WrappedComponent
          components={SentryAppComponentsStore.getComponentByType(type)}
          {...this.props}
        />
      );
    },
  });

export default withSentryAppComponents;
