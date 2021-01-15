import React from 'react';

import PlatformList from 'app/components/platformList';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import Projects from 'app/utils/projects';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  projectIds: Array<number>;
  organization: Organization;
};

function ProjectList({projectIds, organization}: Props) {
  if (!projectIds.length) {
    return <React.Fragment>{t('All')}</React.Fragment>;
  }

  return (
    <Projects orgId={organization.slug} allProjects>
      {({projects}) => {
        const projectPlatforms = projectIds.map(projectId => {
          const project = (projects as Project[]).find(p => p.id === String(projectId));
          return project?.platform ?? 'other';
        });
        return <PlatformList platforms={projectPlatforms} />;
      }}
    </Projects>
  );
}

export default withOrganization(ProjectList);
