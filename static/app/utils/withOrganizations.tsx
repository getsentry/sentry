import {Component} from 'react';

import OrganizationsStore from 'sentry/stores/organizationsStore';
import type {OrganizationSummary} from 'sentry/types/organization';
import getDisplayName from 'sentry/utils/getDisplayName';

type InjectedOrganizationsProps = {
  organizations: OrganizationSummary[];
  organizationsLoading?: boolean;
};

type State = {
  organizations: OrganizationSummary[];
};

function withOrganizations<P extends InjectedOrganizationsProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithOrganizations extends Component<
    Omit<P, keyof InjectedOrganizationsProps> & Partial<InjectedOrganizationsProps>,
    State
  > {
    static displayName = `withOrganizations(${getDisplayName(WrappedComponent)})`;

    state: State = {organizations: OrganizationsStore.getAll()};

    componentWillUnmount() {
      this.unsubscribe();
    }

    unsubscribe = OrganizationsStore.listen(
      (organizations: OrganizationSummary[]) => this.setState({organizations}),
      undefined
    );

    render() {
      const {organizationsLoading, organizations, ...props} = this.props as P;
      return (
        <WrappedComponent
          organizationsLoading={
            organizationsLoading ?? !OrganizationsStore.getState().loaded
          }
          organizations={organizations ?? this.state.organizations}
          // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
          {...(props as Omit<P, 'organizationsLoading' | 'organizations'> as any)}
        />
      );
    }
  }

  return WithOrganizations;
}

export default withOrganizations;
