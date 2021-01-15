import React from 'react';

import PlatformList from 'app/components/platformList';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import Projects from 'app/utils/projects';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

type Props = {
  projectIds: Array<number>;
  projects: Array<Project>;
  organization: Organization;
};

function ProjectList({projectIds, organization, ...props}: Props) {
  if (!projectIds.length) {
    return <React.Fragment>{t('All')}</React.Fragment>;
  }

  const filteresProjects = props.projects.filter(project =>
    projectIds.includes(Number(project.id))
  );

  if (filteresProjects.length === projectIds.length) {
    const projectPlatforms = filteresProjects.map(
      projectPlatform => projectPlatform?.platform ?? 'other'
    );
    return <PlatformList platforms={projectPlatforms} />;
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

export default withOrganization(withProjects(ProjectList));
