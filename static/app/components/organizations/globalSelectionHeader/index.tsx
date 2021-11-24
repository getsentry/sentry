import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import partition from 'lodash/partition';

import ConfigStore from 'sentry/stores/configStore';
import {Organization, Project} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';

import GlobalSelectionHeader from './globalSelectionHeader';
import InitializeGlobalSelectionHeader from './initializeGlobalSelectionHeader';

type GlobalSelectionHeaderProps = Omit<
  React.ComponentPropsWithoutRef<typeof GlobalSelectionHeader>,
  'router' | 'nonMemberProjects' | 'memberProjects' | 'selection'
>;

type Props = {
  organization: Organization;
  projects: Project[];
} & WithRouterProps &
  GlobalSelectionHeaderProps &
  Partial<
    Pick<React.ComponentProps<typeof InitializeGlobalSelectionHeader>, 'skipLoadLastUsed'>
  >;

function GlobalSelectionHeaderContainer({
  organization,
  projects,
  loadingProjects,
  location,
  router,
  routes,
  defaultSelection,
  forceProject,
  shouldForceProject,
  skipLoadLastUsed,
  specificProjectSlugs,
  showAbsolute,
  ...props
}: Props) {
  const {isSuperuser} = ConfigStore.get('user');
  const isOrgAdmin = organization.access.includes('org:admin');

  const specifiedProjects = specificProjectSlugs
    ? projects.filter(project => specificProjectSlugs.includes(project.slug))
    : projects;

  const [memberProjects, otherProjects] = partition(
    specifiedProjects,
    project => project.isMember
  );

  const nonMemberProjects = isSuperuser || isOrgAdmin ? otherProjects : [];

  const enforceSingleProject = !organization.features.includes('global-views');

  // We can initialize before ProjectsStore is fully loaded if we don't need to enforce single project.
  return (
    <React.Fragment>
      {(!loadingProjects || (!shouldForceProject && !enforceSingleProject)) && (
        <InitializeGlobalSelectionHeader
          location={location}
          skipLoadLastUsed={!!skipLoadLastUsed}
          router={router}
          organization={organization}
          defaultSelection={defaultSelection}
          forceProject={forceProject}
          shouldForceProject={!!shouldForceProject}
          shouldEnforceSingleProject={enforceSingleProject}
          memberProjects={memberProjects}
          showAbsolute={showAbsolute}
        />
      )}
      <GlobalSelectionHeader
        {...props}
        loadingProjects={loadingProjects}
        location={location}
        organization={organization}
        router={router}
        routes={routes}
        projects={projects}
        shouldForceProject={!!shouldForceProject}
        defaultSelection={defaultSelection}
        forceProject={forceProject}
        memberProjects={memberProjects}
        nonMemberProjects={nonMemberProjects}
        showAbsolute={showAbsolute}
      />
    </React.Fragment>
  );
}

export default withOrganization(withProjects(withRouter(GlobalSelectionHeaderContainer)));
