import * as React from 'react';

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
  sdkUpdates: ProjectSdkUpdates[] | null;
};

function withSdkUpdates<P extends InjectedProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithProjectSdkSuggestions extends React.Component<
    Omit<P, keyof InjectedProps> & Props,
    State
  > {
    state: State = {sdkUpdates: []};

    componentDidMount() {
      const orgSlug = this.props.organization.slug;
      const updates = SdkUpdatesStore.getUpdates(orgSlug);

      // Load SdkUpdates
      if (updates !== undefined) {
        this.onSdkUpdatesUpdate();
        return;
      }

      loadSdkUpdates(this.props.api, orgSlug);
    }

    componentWillUnmount() {
      this.unsubscribe();
    }
    unsubscribe = SdkUpdatesStore.listen(() => this.onSdkUpdatesUpdate(), undefined);

    onSdkUpdatesUpdate() {
      const sdkUpdates = SdkUpdatesStore.getUpdates(this.props.organization.slug) ?? null;
      this.setState({sdkUpdates});
    }

    render() {
      // TODO(ts) This unknown cast isn't great but Typescript complains about arbitrary
      // types being possible. I think this is related to the additional HoC wrappers causing type data to
      // be lost.
      return (
        <WrappedComponent
          {...(this.props as unknown as P)}
          sdkUpdates={this.state.sdkUpdates}
        />
      );
    }
  }

  return withOrganization(withApi(WithProjectSdkSuggestions));
}

export default withSdkUpdates;
