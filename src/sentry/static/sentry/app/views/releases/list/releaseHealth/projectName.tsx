import React from 'react';

import GlobalSelectionLink from 'app/components/globalSelectionLink';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import {ReleaseProject} from 'app/types';

type Props = {
  orgSlug: string;
  releaseVersion: string;
  project: ReleaseProject;
};

const ProjectName = ({orgSlug, releaseVersion, project}: Props) => (
  <GlobalSelectionLink
    to={{
      pathname: `/organizations/${orgSlug}/releases/${encodeURIComponent(
        releaseVersion
      )}/`,
      query: {project: project.id},
    }}
  >
    <ProjectBadge project={project} avatarSize={16} />
  </GlobalSelectionLink>
);

export default ProjectName;
