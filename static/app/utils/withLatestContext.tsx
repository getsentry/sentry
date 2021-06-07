import * as React from 'react';

import ConfigStore from 'app/stores/configStore';
import LatestContextStore from 'app/stores/latestContextStore';
import {Organization, OrganizationSummary, Project} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';
import withOrganizations from 'app/utils/withOrganizations';

type InjectedLatestContextProps = {
  organizations?: OrganizationSummary[];
  organization?: Organization;
  project?: Project;
  lastRoute?: string;
};

type WithPluginProps = {
  organization?: Organization;
  organizations: OrganizationSummary[];
};

type LatestContextState = typeof LatestContextStore.state;

type State = {
  latestContext: Pick<
    InjectedLatestContextProps,
    'organization' | 'project' | 'lastRoute'
  >;
};

function withLatestContext<P extends InjectedLatestContextProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithLatestContext extends React.Component<
    Omit<P, keyof InjectedLatestContextProps> &
      Partial<InjectedLatestContextProps> &
      WithPluginProps,
    State
  > {
    static displayName = `withLatestContext(${getDisplayName(WrappedComponent)})`;

    constructor(props) {
      super(props);

      const contextData = LatestContextStore.state;
      this.state = {
        latestContext: {
          // TODO(ts) The context data can also be LightWeightOrganization. The cast
          // should be removed when downstream components have their types updated.
          organization: (contextData.organization as Organization) ?? undefined,
          project: contextData.project ?? undefined,
          lastRoute: contextData.lastRoute ?? undefined,
        },
      };
    }

    componentWillUnmount() {
      this.unsubscribe();
    }

    unsubscribe = LatestContextStore.listen((latestContext: LatestContextState) => {
      this.setState(prevState => {
        return {
          ...prevState,
          organization: latestContext.organization ?? undefined,
          project: latestContext.project ?? undefined,
          lastRoute: latestContext.lastRoute ?? undefined,
        };
      });
    }, undefined);

    render() {
      const {organizations} = this.props;
      const {latestContext} = this.state;
      const {
        organization,
        project,
        lastRoute,
      }: {organization?: Organization; project?: Project; lastRoute?: string} =
        latestContext || {};

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
          organizations={organizations}
          project={project}
          lastRoute={lastRoute}
          {...(this.props as P)}
          organization={this.props.organization || latestOrganization}
        />
      );
    }
  }

  return withOrganizations(WithLatestContext);
}

export default withLatestContext;
