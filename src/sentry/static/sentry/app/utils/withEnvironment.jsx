import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import getDisplayName from 'app/utils/getDisplayName';
import LatestContextStore from 'app/stores/latestContextStore';

// Passes the active environment to the wrapped component if the organizations:environments
// feature is active, otherwiss passes null (i.e. the value that means "All environments")

const withEnvironment = WrappedComponent =>
  createReactClass({
    displayName: `withEnvironment(${getDisplayName(WrappedComponent)})`,

    mixins: [Reflux.listenTo(LatestContextStore, 'onLatestContextChange')],

    getInitialState() {
      const latestContext = LatestContextStore.getInitialState();

      return {
        environment: latestContext.environment,
        organization: latestContext.organization,
      };
    },

    onLatestContextChange({environment, organization}) {
      this.setState({environment, organization});
    },

    render() {
      const environment = this.state.environment;

      return <WrappedComponent environment={environment} {...this.props} />;
    },
  });

export default withEnvironment;
