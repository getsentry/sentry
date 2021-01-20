import React from 'react';

import Button from 'app/components/button';
import {t} from 'app/locale';
import {ReleaseProject} from 'app/types';

type Props = {
  orgSlug: string;
  releaseVersion: string;
  project: ReleaseProject;
};

const ProjectLink = ({orgSlug, releaseVersion, project}: Props) => (
  <Button
    size="xsmall"
    to={{
      pathname: `/organizations/${orgSlug}/releases/${encodeURIComponent(
        releaseVersion
      )}/`,
      query: {project: project.id},
    }}
  >
    {t('View')}
  </Button>
);

export default ProjectLink;
