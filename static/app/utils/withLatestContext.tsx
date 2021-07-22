import * as React from 'react';

import ConfigStore from 'app/stores/configStore';
import LatestContextStore from 'app/stores/latestContextStore';
import {
  LightWeightOrganization,
  Organization,
  OrganizationSummary,
  Project,
} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';
import withOrganizations from 'app/utils/withOrganizations';

type InjectedLatestContextProps = {
  organizations?: OrganizationSummary[];
  organization?: LightWeightOrganization | Organization | null;
  project?: Project | null;
  lastRoute?: string | null;
};

type HocProps = {
  organization?: LightWeightOrganization | Organization | null;
  organizations: OrganizationSummary[];
};

type State = {
  latestContext: Omit<InjectedLatestContextProps, 'organizations'>;
};

const fallbackContext: State['latestContext'] = {
  organization: null,
  project: null,
  lastRoute: null,
};

function withLatestContext<P extends InjectedLatestContextProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithLatestContext extends React.Component<
    Omit<P, keyof InjectedLatestContextProps> & HocProps,
    State
  > {
    static displayName = `withLatestContext(${getDisplayName(WrappedComponent)})`;

    state: State = {
      latestContext: LatestContextStore.get(),
    };

    componentWillUmount() {
      this.unsubscribe();
    }
    unsubscribe = LatestContextStore.listen(
      (latestContext: State['latestContext']) => this.setState({latestContext}),
      undefined
    );

    render() {
      const {organizations} = this.props;
      const {latestContext} = this.state;
      const {organization, project, lastRoute} = latestContext || fallbackContext;

      // Even though org details exists in LatestContextStore,
      // fetch organization from OrganizationsStore so that we can
      // expect consistent data structure because OrganizationsStore has a list
      // of orgs but not full org details
      const latestOrganization =
        organization ||
        (organizations && organizations.length
          ? organizations.find(
              ({slug}) => slug === ConfigStore.get('lastOrganization')
            ) || organizations[0]
          : null);

      // TODO(billy): Below is going to be wrong if component is passed project, it will override
      // project from `latestContext`
      return (
        <WrappedComponent
          project={project as Project}
          lastRoute={lastRoute}
          {...(this.props as P)}
          organization={(this.props.organization || latestOrganization) as Organization}
        />
      );
    }
  }
  return withOrganizations(WithLatestContext);
}

export default withLatestContext;
