import React from 'react';

import AsyncComponent from 'app/components/asyncComponent';
import {Organization, ProjectSdkUpdates} from 'app/types';

import withOrganization from './withOrganization';

type InjectedProps = {
  /**
   * List of (Project + SDK)s and potential update suggestions for each
   */
  sdkUpdates?: ProjectSdkUpdates[];
  /**
   * May be used to show a loading state
   */
  loadingSdkUpdates: boolean;
};

type Props = AsyncComponent['props'] & {
  organization: Organization;
  /**
   * Project IDs to limit the updates query to
   */
  projectIds?: string[];
};

type State = AsyncComponent['state'] & {
  sdkList: ProjectSdkUpdates[] | null;
};

function withSdkUpdates<P extends InjectedProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class ProjectSdkSuggestions extends AsyncComponent<
    Props & Omit<P, keyof InjectedProps>,
    State
  > {
    getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
      return [['sdkList', `/organizations/${this.props.organization.slug}/sdk-updates/`]];
    }

    renderLoading() {
      return <WrappedComponent {...((this.props as unknown) as P)} loadingSdkUpdates />;
    }

    renderBody() {
      return (
        <WrappedComponent
          {...((this.props as unknown) as P)}
          sdkUpdates={this.state.sdkList}
          loadingSdkUpdates={false}
        />
      );
    }
  }

  return withOrganization(ProjectSdkSuggestions);
}

export default withSdkUpdates;
