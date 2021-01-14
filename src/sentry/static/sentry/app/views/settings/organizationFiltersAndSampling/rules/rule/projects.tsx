import React from 'react';

import PlatformList from 'app/components/platformList';
import {PlatformKey} from 'app/data/platformCategories';
import {t} from 'app/locale';
import {Project} from 'app/types';
import withProjects from 'app/utils/withProjects';

type Props = {
  projectIds: Array<number>;
  projects: Array<Project>;
};

function Projects({projectIds, projects}: Props) {
  if (!projectIds.length) {
    return <React.Fragment>{t('All')}</React.Fragment>;
  }

  const projectPlatforms = projects
    .filter(project => projectIds.includes(Number(project.id)))
    .map(({platform}) => platform ?? 'other') as Array<PlatformKey>;

  return <PlatformList platforms={projectPlatforms} />;
}

export default withProjects(Projects);
