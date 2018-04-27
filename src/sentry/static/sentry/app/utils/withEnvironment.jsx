import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import LatestContextStore from 'app/stores/latestContextStore';

// Passes the active environment to the wrapped component if the organizations:environments
// feature is active, otherwiss passes null (i.e. the value that means "All environments")

const withEnvironment = WrappedComponent =>
  createReactClass({
    displayName: 'withEnvironment',

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
      const features = new Set(
        this.state.organization ? this.state.organization.features : []
      );
      const environment = features.has('environments') ? this.state.environment : null;

      return <WrappedComponent environment={environment} {...this.props} />;
    },
  });

export default withEnvironment;
