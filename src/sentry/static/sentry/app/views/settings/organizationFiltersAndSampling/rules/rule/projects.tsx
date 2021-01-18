import React from 'react';

import PlatformList from 'app/components/platformList';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  projectIds: Array<number>;
  organization: Organization;
};

function ProjectList({projectIds, organization}: Props) {
  if (!projectIds.length) {
    return <React.Fragment>{t('All')}</React.Fragment>;
  }

  const projectPlatforms = organization.projects
    .filter(project => projectIds.includes(Number(project.id)))
    .map(projectPlatform => projectPlatform?.platform ?? 'other');

  return <PlatformList platforms={projectPlatforms} />;
}

export default withOrganization(ProjectList);
