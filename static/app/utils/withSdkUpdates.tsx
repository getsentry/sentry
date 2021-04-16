import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import {loadSdkUpdates} from 'app/actionCreators/sdkUpdates';
import {Client} from 'app/api';
import SdkUpdatesStore from 'app/stores/sdkUpdatesStore';
import {Organization, ProjectSdkUpdates} from 'app/types';

import withApi from './withApi';
import withOrganization from './withOrganization';

type InjectedProps = {
  /**
   * List of (Project + SDK)s and potential update suggestions for each.
   *
   * Null when updates have not been loaded for this org.
   */
  sdkUpdates?: ProjectSdkUpdates[] | null;
};

type Props = {
  organization: Organization;
  /**
   * Project IDs to limit the updates query to
   */
  projectIds?: string[];
  api: Client;
};

type State = {
  sdkUpdates: ProjectSdkUpdates[];
};

function withSdkUpdates<P extends InjectedProps>(
  WrappedComponent: React.ComponentType<P>
) {
  const ProjectSdkSuggestions = createReactClass<
    Props & Omit<P, keyof InjectedProps>,
    State
  >({
    mixins: [Reflux.listenTo(SdkUpdatesStore, 'onSdkUpdatesUpdate') as any],

    getInitialState() {
      return {sdkUpdates: []};
    },

    componentDidMount() {
      const orgSlug = this.props.organization.slug;
      const updates = SdkUpdatesStore.getUpdates(orgSlug);

      // Load SdkUpdates
      if (updates !== undefined) {
        this.onSdkUpdatesUpdate();
        return;
      }

      loadSdkUpdates(this.props.api, orgSlug);
    },

    onSdkUpdatesUpdate() {
      const sdkUpdates = SdkUpdatesStore.getUpdates(this.props.organization.slug) ?? null;
      this.setState({sdkUpdates});
    },

    render() {
      return (
        <WrappedComponent {...(this.props as P)} sdkUpdates={this.state.sdkUpdates} />
      );
    },
  });

  return withOrganization(withApi(ProjectSdkSuggestions));
}

export default withSdkUpdates;
