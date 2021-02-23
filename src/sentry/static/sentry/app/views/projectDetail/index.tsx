import React from 'react';

import ComingSoon from 'app/components/acl/comingSoon';
import Feature from 'app/components/acl/feature';
import {PageContent} from 'app/styles/organization';
import withOrganization from 'app/utils/withOrganization';

import ProjectDetail from './projectDetail';

function ProjectDetailContainer(
  props: Omit<
    React.ComponentProps<typeof ProjectDetail>,
    'projects' | 'loadingProjects' | 'selection'
  >
) {
  function renderNoAccess() {
    return (
      <PageContent>
        <ComingSoon />
      </PageContent>
    );
  }

  return (
    <Feature
      features={['project-detail']}
      organization={props.organization}
      renderDisabled={renderNoAccess}
    >
      <ProjectDetail {...props} />
    </Feature>
  );
}

export default withOrganization(ProjectDetailContainer);
