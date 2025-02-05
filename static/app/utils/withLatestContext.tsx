import {Component} from 'react';

import ConfigStore from 'sentry/stores/configStore';
import LatestContextStore from 'sentry/stores/latestContextStore';
import type {Organization, OrganizationSummary} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import getDisplayName from 'sentry/utils/getDisplayName';
import withOrganizations from 'sentry/utils/withOrganizations';

type InjectedLatestContextProps = {
  organization?: Organization | null;
  organizations?: OrganizationSummary[];
  project?: Project | null;
};

type HocProps = {
  organizations: OrganizationSummary[];
  organization?: Organization | null;
};

type State = {
  latestContext: Omit<InjectedLatestContextProps, 'organizations'>;
};

const fallbackContext: State['latestContext'] = {
  organization: null,
  project: null,
};

function withLatestContext<P extends InjectedLatestContextProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithLatestContext extends Component<
    Omit<P, keyof InjectedLatestContextProps> & HocProps,
    State
  > {
    static displayName = `withLatestContext(${getDisplayName(WrappedComponent)})`;

    state: State = {
      latestContext: LatestContextStore.get(),
    };

    componentWillUnmount() {
      this.unsubscribe();
    }
    unsubscribe = LatestContextStore.listen(
      (latestContext: State['latestContext']) => this.setState({latestContext}),
      undefined
    );

    render() {
      const {organizations} = this.props;
      const {latestContext} = this.state;
      const {organization, project} = latestContext || fallbackContext;

      // Even though org details exists in LatestContextStore,
      // fetch organization from OrganizationsStore so that we can
      // expect consistent data structure because OrganizationsStore has a list
      // of orgs but not full org details
      const latestOrganization =
        organization ||
        (organizations?.length
          ? organizations.find(
              ({slug}) => slug === ConfigStore.get('lastOrganization')
            ) || organizations[0]
          : null);

      // TODO(billy): Below is going to be wrong if component is passed project, it will override
      // project from `latestContext`
      return (
        <WrappedComponent
          project={project as Project}
          // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
          {...(this.props as P as any)}
          organization={(this.props.organization || latestOrganization) as Organization}
        />
      );
    }
  }
  return withOrganizations(WithLatestContext);
}

export default withLatestContext;
