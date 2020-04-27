import * as ReactRouter from 'react-router';
import React from 'react';
import partition from 'lodash/partition';

import {Organization, Project} from 'app/types';
import ConfigStore from 'app/stores/configStore';
import withOrganization from 'app/utils/withOrganization';
import withProjectsSpecified from 'app/utils/withProjectsSpecified';

import GlobalSelectionHeader from './globalSelectionHeader';
import InitializeGlobalSelectionHeader from './initializeGlobalSelectionHeader';

type GlobalSelectionHeaderProps = Omit<
  React.ComponentPropsWithoutRef<typeof GlobalSelectionHeader>,
  'router' | 'nonMemberProjects' | 'memberProjects' | 'selection'
>;

type Props = {
  organization: Organization;
  projects: Project[];
  hasCustomRouting?: boolean;
} & ReactRouter.WithRouterProps &
  GlobalSelectionHeaderProps;

class GlobalSelectionHeaderContainer extends React.Component<Props> {
  getProjects = () => {
    const {organization, projects} = this.props;
    const {isSuperuser} = ConfigStore.get('user');
    const isOrgAdmin = organization.access.includes('org:admin');

    const [memberProjects, nonMemberProjects] = partition(
      projects,
      project => project.isMember
    );

    if (isSuperuser || isOrgAdmin) {
      return [memberProjects, nonMemberProjects];
    }

    return [memberProjects, []];
  };

  render() {
    const {
      loadingProjects,
      location,
      organization,
      router,
      routes,

      defaultSelection,
      forceProject,
      shouldForceProject,
      hasCustomRouting,
      ...props
    } = this.props;
    const enforceSingleProject = !organization.features.includes('global-views');
    const [memberProjects, nonMemberProjects] = this.getProjects();

    return (
      <React.Fragment>
        {!loadingProjects && (
          <InitializeGlobalSelectionHeader
            location={location}
            router={router}
            routes={routes}
            organization={organization}
            defaultSelection={defaultSelection}
            forceProject={forceProject}
            isDisabled={!!hasCustomRouting}
            shouldForceProject={!!shouldForceProject}
            shouldEnforceSingleProject={!hasCustomRouting && enforceSingleProject}
            memberProjects={memberProjects}
          />
        )}
        <GlobalSelectionHeader
          {...props}
          loadingProjects={loadingProjects}
          location={location}
          organization={organization}
          router={!hasCustomRouting ? router : null}
          routes={routes}
          shouldForceProject={!!shouldForceProject}
          defaultSelection={defaultSelection}
          forceProject={forceProject}
          memberProjects={memberProjects}
          nonMemberProjects={nonMemberProjects}
        />
      </React.Fragment>
    );
  }
}

export default withOrganization(
  withProjectsSpecified(ReactRouter.withRouter(GlobalSelectionHeaderContainer))
);
