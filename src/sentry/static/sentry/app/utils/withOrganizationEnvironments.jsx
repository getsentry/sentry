import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import getDisplayName from 'app/utils/getDisplayName';
import OrganizationEnvironmentsStore from 'app/stores/organizationEnvironmentsStore';

const withOrganizationEnvironments = WrappedComponent =>
  createReactClass({
    displayName: `withEnvironment(${getDisplayName(WrappedComponent)})`,

    mixins: [Reflux.listenTo(OrganizationEnvironmentsStore, 'onChange')],

    getInitialState() {
      return {
        environments: OrganizationEnvironmentsStore.getActive(),
      };
    },

    onChange(environments) {
      this.setState({environments});
    },

    render() {
      const {environments} = this.state;

      return <WrappedComponent organizationEnvironments={environments} {...this.props} />;
    },
  });

export default withOrganizationEnvironments;
